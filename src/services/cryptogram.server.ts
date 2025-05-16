import {
  all,
  filter,
  first,
  flatMap,
  get,
  join,
  map,
  max,
  pipe,
  rangeUntil,
  reduce,
  sum,
  toGrouped,
  toMap,
  toSet,
} from 'lfi'
import { invariant } from '@epic-web/invariant'
import type { Dictionary } from './dictionary.server.ts'
import { computePattern } from './pattern.server.ts'
import { parseWords } from './words.server.ts'

/**
 * Finds possible ciphers for the given ciphertext, using the given dictionary.
 *
 * Returns after finding the given number of solutions, or earlier if the search
 * space was exhausted before finding the given number of solutions.
 */
const solveCryptogram = ({
  ciphertext,
  dictionary,
  maxSolutionCount,
  timeoutMs = Number.POSITIVE_INFINITY,
}: {
  ciphertext: string
  dictionary: Dictionary
  maxSolutionCount: number
  timeoutMs?: number
}): Map<string, Map<string, string>> => {
  const startTimeMs = Date.now()
  const solutions = new Map<
    string,
    { meanFrequency: number; cipher: Map<string, string> }
  >()

  const words = parseWords(ciphertext, dictionary.alphabet)
  
  // Add a check for very short cryptograms or those with very few unique words
  if (words.size < 2) {
    // Add brute force approach for very short cryptograms
    return tryBruteForceForShortCryptogram(ciphertext, dictionary, maxSolutionCount, timeoutMs);
  }
  
  const wordCandidatesStack: ReadonlyMap<string, ReadonlySet<string>>[] = [
    findWordCandidates(words, dictionary),
  ]
  do {
    // Add a time check more frequently to avoid getting stuck in long loops
    if (Date.now() - startTimeMs >= timeoutMs) {
      break;
    }

    const wordCandidates = pruneWordCandidates(
      wordCandidatesStack.pop()!,
      dictionary,
    )
    if (!wordCandidates) {
      continue
    }

    const maxCandidateWordsSize = pipe(
      wordCandidates,
      map(([, candidateWords]) => candidateWords.size),
      max,
      get,
    )
    if (maxCandidateWordsSize > 1) {
      wordCandidatesStack.push(
        ...partitionWordCandidates(wordCandidates).reverse(),
      )
      continue
    }

    const cipher = computeCipher(
      pipe(
        wordCandidates,
        map(
          ([word, candidateWords]) =>
            [word, get(first(candidateWords))] as const,
        ),
        reduce(toMap()),
      ),
    )
    const plaintext = decryptCiphertext(ciphertext, cipher)
    if (solutions.has(plaintext)) {
      continue
    }

    solutions.set(plaintext, {
      meanFrequency: computeMeanFrequency(plaintext, dictionary),
      cipher,
    })
  } while (
    solutions.size < maxSolutionCount &&
    wordCandidatesStack.length &&
    Date.now() - startTimeMs < timeoutMs
  )

  // If no solutions found with the regular approach, try the frequency analysis approach
  if (solutions.size === 0 && Date.now() - startTimeMs < timeoutMs) {
    const frequencySolutions = tryFrequencyAnalysis(ciphertext, dictionary, maxSolutionCount, timeoutMs - (Date.now() - startTimeMs));
    if (frequencySolutions.size > 0) {
      // Convert the structure to match the expected return type
      const convertedSolutions = new Map<string, Map<string, string>>();
      for (const [plaintext, solution] of frequencySolutions) {
        convertedSolutions.set(plaintext, solution.cipher);
      }
      return convertedSolutions;
    }

    // Try celebrity quote analysis as a last resort
    const celebritySolutions = tryCelebrityQuoteAnalysis(ciphertext, dictionary, maxSolutionCount, timeoutMs - (Date.now() - startTimeMs));
    if (celebritySolutions.size > 0) {
      // Convert the structure to match the expected return type
      const convertedSolutions = new Map<string, Map<string, string>>();
      for (const [plaintext, solution] of celebritySolutions) {
        convertedSolutions.set(plaintext, solution.cipher);
      }
      return convertedSolutions;
    }
  }

  return pipe(
    [...solutions].sort(
      ([, solution1], [, solution2]) =>
        solution2.meanFrequency - solution1.meanFrequency,
    ),
    map(
      ([plaintext, { cipher }]) =>
        [
          plaintext,
          new Map(
            [...cipher].sort(([letter1], [letter2]) =>
              letter1.localeCompare(letter2),
            ),
          ),
        ] as const,
    ),
    reduce(toMap()),
  )
}

const findWordCandidates = (
  words: ReadonlySet<string>,
  dictionary: Dictionary,
): Map<string, ReadonlySet<string>> =>
  pipe(
    words,
    map(
      word =>
        [
          word,
          dictionary.patternWords.get(computePattern(word)) ?? new Set(),
        ] as const,
    ),
    reduce(toMap()),
  )

/**
 * Returns a copy of the given word candidates with pairwise incompatible
 * candidates removed, or undefined if any word has no candidates remaining.
 */
const pruneWordCandidates = (
  wordCandidates: ReadonlyMap<string, ReadonlySet<string>>,
  dictionary: Dictionary,
): Map<string, Set<string>> | undefined => {
  const letterCandidates = computeLetterCandidates(wordCandidates, dictionary)
  const prunedWordCandidates = pipe(
    wordCandidates,
    map(([word, candidateWords]): [string, Set<string>] => [
      word,
      pipe(
        candidateWords,
        filter(candidateWord =>
          pipe(
            zipWords(word, candidateWord),
            all(([letter, candidateLetter]) =>
              letterCandidates.get(letter)!.has(candidateLetter),
            ),
          ),
        ),
        reduce(toSet()),
      ),
    ]),
    reduce(toMap()),
  )
  return prunedWordCandidates.size > 0 &&
    all(([, candidateWords]) => candidateWords.size > 0, prunedWordCandidates)
    ? prunedWordCandidates
    : undefined
}

/**
 * Computes the letter candidates from the given word candidates.
 *
 * For example, given the following word candidates:
 * ```
 * MCDMRCNSFX => { DEADWEIGHT, DISDAINFUL, GREGARIOUS, PERPLEXITY }
 * MSCNPPRX => { AFLUTTER, BEDROOMS, GORILLAS, PROCEEDS, TYPHOONS }
 * ```
 *
 * `MCDMRCNSFX`'s candidates indicate `M` can decrypt to `D`, `G`, or `P`.
 * However, `MSCNPPRX`'s candidates indicate `M` can decrypt to `A`, `B`, `G`,
 * `P`, or `T`. Choosing to have `M` decrypt to a candidate which is not in both
 * sets will leave a word without a viable candidate. Therefore, `M` can only
 * decrypt to the intersection of these sets, namely `G` or `P`. This function
 * performs these intersections across all words for all letters.
 *
 * Consider also the following situation where it was deduced that:
 * * `M` can decrypt to `G` or `P`
 * * `L` can decrypt to `G` or `P`.
 * * `X` can decrypt to `G`, `P`, or `W`
 *
 * `X` cannot decrypt to `G` or `P` because if it did, then there would not be
 * enough letters left for `M` and `L` to decrypt to different letters, by
 * pigeonhole principle. So any letters, other than `M` and `L`, which have `G`
 * or `P` as possible candidates can have them removed as candidates. In fact,
 * whenever there are `n` letters which each decrypt to the same set of `n`
 * candidates, all other letters can have those candidates removed as
 * candidates. Consequently, if there are more than `n` letters with the same
 * set of `n` candidates, then there is no solution that satisfies the given
 * word candidates.
 */
const computeLetterCandidates = (
  wordCandidates: ReadonlyMap<string, ReadonlySet<string>>,
  dictionary: Dictionary,
): Map<string, Set<string>> => {
  const letterCandidates = pipe(
    wordCandidates,
    map(([word, candidateWords]) =>
      pipe(
        candidateWords,
        flatMap(candidateWord => zipWords(word, candidateWord)),
        reduce(toGrouped(toSet(), toMap())),
      ),
    ),
    reduce({
      create: () =>
        pipe(
          dictionary.alphabet,
          map(letter => [letter, new Set(dictionary.alphabet)] as const),
          reduce(toMap()),
        ),
      add: (letterCandidates1, letterCandidates2) =>
        pipe(
          letterCandidates1,
          map(([letter, candidateLetter]): [string, Set<string>] => [
            letter,
            intersection(
              candidateLetter,
              letterCandidates2.get(letter) ?? dictionary.alphabet,
            ),
          ]),
          reduce(toMap()),
        ),
    }),
  )

  let candidatesChanged
  do {
    // Group letters by their candidate sets. For example:
    // * 'X' -> { 'A', 'B' }
    // * 'Y' -> { 'A', 'B' }
    // * 'Z' -> { 'A' }
    // Becomes:
    // * { 'A', 'B' } -> { 'X', 'Y' }
    // * { 'A' } -> { 'Z' }
    const candidatesLetters = pipe(
      letterCandidates,
      map(([letter, candidateLetters]): [string, string] => [
        [...candidateLetters].sort().join(``),
        letter,
      ]),
      reduce(toGrouped(toSet(), toMap())),
    )

    // Subtracts letters from candidates which have been pigeonholed (see
    // function documentation above).
    candidatesChanged = false
    for (const [letter, candidateLetters] of letterCandidates) {
      for (const [candidateLettersString, letters] of candidatesLetters) {
        const currentCandidateLetters = new Set(candidateLettersString)
        if (
          (currentCandidateLetters.size === letters.size &&
            !letters.has(letter)) ||
          currentCandidateLetters.size < letters.size
        ) {
          for (const candidate of currentCandidateLetters) {
            const deleted = candidateLetters.delete(candidate)
            candidatesChanged ||= deleted
          }
        }
      }
    }
  } while (candidatesChanged)

  return letterCandidates
}

const intersection = <Value>(
  set1: ReadonlySet<Value>,
  set2: ReadonlySet<Value>,
): Set<Value> => {
  const intersection = new Set<Value>()
  for (const value of set1) {
    if (set2.has(value)) {
      intersection.add(value)
    }
  }
  return intersection
}

/**
 * Partitions the given word candidates map into multiple maps.
 *
 * The map is partitioned by producing maps where a single candidate is chosen
 * for words that had multiple candidates, except for potentially the last
 * returned map.
 *
 * The returned maps retain the full set of cross-word candidate combinations
 * from the original map and are ordered from highest theoretical frequency to
 * lowest.
 */
const partitionWordCandidates = (
  wordCandidates: ReadonlyMap<string, ReadonlySet<string>>,
): Map<string, Set<string>>[] => {
  const partitionedWordCandidates: Map<string, Set<string>>[] = []

  const remainingWordCandidates = pipe(
    wordCandidates,
    map(([word, wordCandidates]) => [word, new Set(wordCandidates)] as const),
    reduce(toMap()),
  )
  for (const [word, candidateWords] of remainingWordCandidates) {
    if (candidateWords.size === 1) {
      continue
    }

    const candidateWord = get(first(candidateWords))
    remainingWordCandidates.get(word)!.delete(candidateWord)

    const newWordCandidates = pipe(
      remainingWordCandidates,
      map(([word, wordCandidates]) => [word, new Set(wordCandidates)] as const),
      reduce(toMap()),
    )
    newWordCandidates.set(word, new Set([candidateWord]))
    partitionedWordCandidates.push(newWordCandidates)
  }

  partitionedWordCandidates.push(remainingWordCandidates)

  return partitionedWordCandidates
}

/**
 * Computes ciphertext letter to plaintext letter mappings (a cipher) from the
 * given ciphertext word to plaintext word mappings, which are assumed to be
 * pairwise compatible.
 */
const computeCipher = (wordCandidates: ReadonlyMap<string, string>) => {
  const cipher = pipe(
    wordCandidates,
    flatMap(([word, candidateWord]) => zipWords(word, candidateWord)),
    reduce(toGrouped(toSet(), toMap())),
    map(([letter, candidateLetters]) => {
      invariant(
        candidateLetters.size === 1,
        `Expected once candidate per letter`,
      )
      return [letter, get(first(candidateLetters))] as const
    }),
    reduce(toMap()),
  )
  invariant(
    new Set(cipher.values()).size === cipher.size,
    `Expected plaintext letters to be unique`,
  )
  return cipher
}

const zipWords = (word1: string, word2: string): Iterable<[string, string]> => {
  invariant(word1.length === word2.length, `Expected same length words`)
  return pipe(
    rangeUntil(0, word1.length),
    map(index => [word1[index]!, word2[index]!]),
  )
}

const decryptCiphertext = (
  ciphertext: string,
  cipher: Map<string, string>,
): string =>
  pipe(
    ciphertext,
    map(letter => cipher.get(letter) ?? letter),
    join(``),
  )

const computeMeanFrequency = (
  plaintext: string,
  dictionary: Dictionary,
): number => {
  const words = parseWords(plaintext, dictionary.alphabet)
  invariant(words.size > 0, `Expected at least one word`)

  const frequencySum = pipe(
    words,
    map(word => dictionary.wordFrequencies.get(word) ?? 0),
    sum,
  )
  const frequencyMean = frequencySum / words.size

  return frequencyMean
}

/**
 * Tries to solve very short cryptograms using a more brute force approach.
 */
const tryBruteForceForShortCryptogram = (
  ciphertext: string,
  dictionary: Dictionary,
  maxSolutionCount: number,
  timeoutMs: number
): Map<string, Map<string, string>> => {
  const startTimeMs = Date.now()
  const solutions = new Map<
    string,
    { meanFrequency: number; cipher: Map<string, string> }
  >()
  
  // Extract unique letters from ciphertext
  const uniqueLetters = new Set<string>();
  for (const char of ciphertext) {
    if (dictionary.alphabet.has(char)) {
      uniqueLetters.add(char);
    }
  }
  
  // If there are too many unique letters for brute force, skip
  if (uniqueLetters.size > 10) {
    return new Map<string, Map<string, string>>();
  }
  
  // Generate possible permutations (limited approach for short texts)
  const permutationAttempts = Math.min(1000, Math.pow(26, uniqueLetters.size));
  const uniqueLettersArray = [...uniqueLetters];
  
  for (let i = 0; i < permutationAttempts; i++) {
    if (Date.now() - startTimeMs >= timeoutMs) {
      break;
    }
    
    const cipher = new Map<string, string>();
    
    // Generate a random mapping for each letter
    for (const letter of uniqueLettersArray) {
      let candidateLetter;
      do {
        const randomIndex = Math.floor(Math.random() * 26);
        candidateLetter = String.fromCharCode(65 + randomIndex); // A-Z
      } while ([...cipher.values()].includes(candidateLetter));
      
      cipher.set(letter, candidateLetter);
    }
    
    const plaintext = decryptCiphertext(ciphertext, cipher);
    
    // Check if this produces valid words
    const words = parseWords(plaintext, dictionary.alphabet);
    let validWordCount = 0;
    
    for (const word of words) {
      if (dictionary.wordFrequencies.has(word)) {
        validWordCount++;
      }
    }
    
    // If a significant portion of words are valid, consider it a solution
    if (validWordCount > 0 && validWordCount / words.size >= 0.5) {
      solutions.set(plaintext, {
        meanFrequency: computeMeanFrequency(plaintext, dictionary),
        cipher,
      });
      
      if (solutions.size >= maxSolutionCount) {
        break;
      }
    }
  }
  
  // Convert solutions to the expected return type
  const convertedSolutions = new Map<string, Map<string, string>>();
  for (const [plaintext, solution] of solutions) {
    convertedSolutions.set(plaintext, solution.cipher);
  }
  
  return convertedSolutions;
}

/**
 * Tries to solve cryptograms using frequency analysis approach.
 */
const tryFrequencyAnalysis = (
  ciphertext: string,
  dictionary: Dictionary,
  maxSolutionCount: number,
  timeoutMs: number
): Map<string, { meanFrequency: number; cipher: Map<string, string> }> => {
  const startTimeMs = Date.now()
  const solutions = new Map<
    string,
    { meanFrequency: number; cipher: Map<string, string> }
  >()
  
  // English letter frequency order (most to least common)
  const englishFrequency = "ETAOINSRHDLUCMFYWGPBVKXQJZ";
  
  // Count letter frequencies in the ciphertext
  const letterCount = new Map<string, number>();
  for (const char of ciphertext) {
    if (dictionary.alphabet.has(char)) {
      letterCount.set(char, (letterCount.get(char) || 0) + 1);
    }
  }
  
  // Sort letters by frequency
  const sortedCipherLetters = [...letterCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);
  
  // Create a cipher mapping based on frequency
  const frequencyCipher = new Map<string, string>();
  for (let i = 0; i < sortedCipherLetters.length; i++) {
    const sourceLetter = sortedCipherLetters[i];
    if (!sourceLetter) continue;
    
    if (i < englishFrequency.length) {
      const targetLetter = englishFrequency.charAt(i);
      frequencyCipher.set(sourceLetter, targetLetter);
    } else {
      // For any additional characters, assign remaining letters
      const remainingIndex = i % englishFrequency.length;
      const targetLetter = englishFrequency.charAt(remainingIndex);
      frequencyCipher.set(sourceLetter, targetLetter);
    }
  }
  
  // Try the frequency-based cipher
  const plaintext = decryptCiphertext(ciphertext, frequencyCipher);
  
  if (plaintext) {
    // Check if this produces valid words
    const words = parseWords(plaintext, dictionary.alphabet);
    let validWordCount = 0;
    
    for (const word of words) {
      if (dictionary.wordFrequencies.has(word)) {
        validWordCount++;
      }
    }
    
    // If a significant portion of words are valid, consider it a solution
    if (validWordCount > 0 && validWordCount / words.size >= 0.3) {
      solutions.set(plaintext, {
        meanFrequency: computeMeanFrequency(plaintext, dictionary),
        cipher: frequencyCipher
      });
    }
  }
  
  // Try permutations of the frequency cipher
  const attempts = Math.min(500, timeoutMs / 10);
  for (let i = 0; i < attempts; i++) {
    if (Date.now() - startTimeMs >= timeoutMs || solutions.size >= maxSolutionCount) {
      break;
    }
    
    // Create a modified cipher by swapping some letters
    const modifiedCipher = new Map(frequencyCipher);
    
    // Swap a few letters randomly
    const swapCount = Math.min(3, sortedCipherLetters.length);
    for (let j = 0; j < swapCount; j++) {
      // Make sure we have at least 2 letters to swap
      if (sortedCipherLetters.length < 2) continue;
      
      const index1 = Math.floor(Math.random() * sortedCipherLetters.length);
      const index2 = Math.floor(Math.random() * sortedCipherLetters.length);
      
      if (index1 !== index2) {
        const letter1 = sortedCipherLetters[index1];
        const letter2 = sortedCipherLetters[index2];
        
        if (!letter1 || !letter2) continue;
        
        // Skip if either letter doesn't exist in our cipher
        if (!modifiedCipher.has(letter1) || !modifiedCipher.has(letter2)) continue;
        
        // Get values, we now know they exist
        const value1 = modifiedCipher.get(letter1);
        const value2 = modifiedCipher.get(letter2);
        
        if (!value1 || !value2) continue;
        
        // Swap the values
        modifiedCipher.set(letter1, value2);
        modifiedCipher.set(letter2, value1);
      }
    }
    
    const modifiedPlaintext = decryptCiphertext(ciphertext, modifiedCipher);
    
    if (modifiedPlaintext) {
      // Check if this produces valid words
      const modifiedWords = parseWords(modifiedPlaintext, dictionary.alphabet);
      let modifiedValidWordCount = 0;
      
      for (const word of modifiedWords) {
        if (dictionary.wordFrequencies.has(word)) {
          modifiedValidWordCount++;
        }
      }
      
      // If a significant portion of words are valid, consider it a solution
      if (modifiedValidWordCount > 0 && modifiedValidWordCount / modifiedWords.size >= 0.3) {
        solutions.set(modifiedPlaintext, {
          meanFrequency: computeMeanFrequency(modifiedPlaintext, dictionary),
          cipher: modifiedCipher
        });
      }
    }
  }
  
  return solutions;
}

/**
 * Special solver for celebrity quotes that might have common patterns.
 */
const tryCelebrityQuoteAnalysis = (
  ciphertext: string,
  dictionary: Dictionary,
  maxSolutionCount: number,
  timeoutMs: number
): Map<string, { meanFrequency: number; cipher: Map<string, string> }> => {
  const startTimeMs = Date.now()
  const solutions = new Map<
    string,
    { meanFrequency: number; cipher: Map<string, string> }
  >()
  
  // Celebrity quote patterns often have common words like "THE", "AND", "THAT", "WHEN", etc.
  // Common author attribution patterns: "- AUTHOR NAME"
  
  // First, try to identify the author attribution part
  const parts = ciphertext.split('–');
  let quoteText = ciphertext;
  let authorPart = '';
  
  if (parts.length > 1) {
    // Last part is likely the author
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      authorPart = lastPart.trim();
    }
    // The rest is the quote
    quoteText = parts.slice(0, parts.length - 1).join('–').trim();
  }
  
  // Common English letter frequency order (most to least common)
  const englishFrequency = "ETAOINHSRDLUCMFWYGPBVKJXQZ";
  
  // Common starting combinations for celebrity quotes
  const commonStartingPatterns = [
    "THE", "I ", "IF ", "WHEN", "LIFE", "LOVE", "YOU ", "A ", "IT ", "NEVER", "ALWAYS"
  ];
  
  // Common ending words for quotes
  const commonEndingPatterns = [
    ".", "!", "?", " IT.", " YOU.", " LIFE.", " LOVE.", " ME.", " THEM."
  ];
  
  // Count letter frequencies in the ciphertext
  const letterCount = new Map<string, number>();
  for (const char of ciphertext) {
    if (dictionary.alphabet.has(char)) {
      letterCount.set(char, (letterCount.get(char) || 0) + 1);
    }
  }
  
  // Sort letters by frequency
  const sortedCipherLetters = [...letterCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);
  
  // Create multiple frequency-based ciphers with various heuristics
  const baseCiphers: Map<string, string>[] = [];
  
  // Standard frequency-based cipher
  const standardCipher = new Map<string, string>();
  for (let i = 0; i < sortedCipherLetters.length; i++) {
    const sourceLetter = sortedCipherLetters[i];
    if (!sourceLetter) continue;
    
    if (i < englishFrequency.length) {
      const targetLetter = englishFrequency.charAt(i);
      standardCipher.set(sourceLetter, targetLetter);
    } else {
      // For any additional characters, assign remaining letters
      const remainingIndex = i % englishFrequency.length;
      const targetLetter = englishFrequency.charAt(remainingIndex);
      standardCipher.set(sourceLetter, targetLetter);
    }
  }
  baseCiphers.push(standardCipher);
  
  // Try to identify common patterns and create specialized ciphers
  // For example, if we detect quotation marks, apostrophes, etc.
  
  // Get words from ciphertext
  const words = [...parseWords(ciphertext, dictionary.alphabet)];
  
  // Check for short words that might be "A", "I", "AN", "TO", "OF", etc.
  const oneLetterWords = words.filter(word => word.length === 1);
  const twoLetterWords = words.filter(word => word.length === 2);
  const threeLetterWords = words.filter(word => word.length === 3);
  
  // Multiple possible ciphers
  for (let attempt = 0; attempt < 5; attempt++) {
    if (Date.now() - startTimeMs >= timeoutMs) break;
    
    // Create a specialized cipher based on heuristics
    const specializedCipher = new Map(standardCipher);
    
    // Try mapping single letter words to common options
    if (oneLetterWords.length > 0) {
      // Common single letter words in English: I, A
      for (const word of oneLetterWords) {
        // 80% chance to map to "I", 20% to "A"
        if (Math.random() < 0.8) {
          specializedCipher.set(word, "I");
        } else {
          specializedCipher.set(word, "A");
        }
      }
    }
    
    // Try mapping common two and three letter words
    const commonTwoLetterWords = ["TO", "OF", "IN", "IS", "IT", "BE", "AS", "AT", "SO", "WE", "HE", "BY", "OR", "ON", "DO", "IF", "ME", "MY", "UP", "AN", "GO", "NO", "US", "AM"];
    const commonThreeLetterWords = ["THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "ANY", "CAN", "HAD", "HER", "WAS", "ONE", "OUR", "OUT", "DAY", "GET", "HAS", "HIM", "HOW", "MAN", "NEW", "NOW", "OLD", "SEE", "TWO", "WAY", "WHO", "BOY", "DID", "ITS", "LET", "PUT", "SAY", "SHE", "TOO", "USE"];
    
    for (const word of twoLetterWords) {
      const randomIndex = Math.floor(Math.random() * commonTwoLetterWords.length);
      const targetWord = commonTwoLetterWords[randomIndex];
      
      // Map letters from source to target
      if (targetWord && word.length === targetWord.length) {
        for (let i = 0; i < word.length; i++) {
          const sourceLetter = word.charAt(i);
          const targetLetter = targetWord.charAt(i);
          
          if (sourceLetter && targetLetter) {
            specializedCipher.set(sourceLetter, targetLetter);
          }
        }
      }
    }
    
    for (const word of threeLetterWords) {
      const randomIndex = Math.floor(Math.random() * commonThreeLetterWords.length);
      const targetWord = commonThreeLetterWords[randomIndex];
      
      // Map letters from source to target
      if (targetWord && word.length === targetWord.length) {
        for (let i = 0; i < word.length; i++) {
          const sourceLetter = word.charAt(i);
          const targetLetter = targetWord.charAt(i);
          
          if (sourceLetter && targetLetter) {
            specializedCipher.set(sourceLetter, targetLetter);
          }
        }
      }
    }
    
    // Make sure the cipher is still valid (doesn't map multiple sources to the same target)
    const targets = new Set<string>();
    let invalidCipher = false;
    
    for (const [_, target] of specializedCipher) {
      if (targets.has(target)) {
        invalidCipher = true;
        break;
      }
      targets.add(target);
    }
    
    if (!invalidCipher) {
      baseCiphers.push(specializedCipher);
    }
  }
  
  // Try each base cipher and its variations
  for (const baseCipher of baseCiphers) {
    if (Date.now() - startTimeMs >= timeoutMs || solutions.size >= maxSolutionCount) {
      break;
    }
    
    // Try the base cipher
    const plaintext = decryptCiphertext(ciphertext, baseCipher);
    
    if (plaintext) {
      // Check if this produces valid words
      const words = parseWords(plaintext, dictionary.alphabet);
      let validWordCount = 0;
      
      for (const word of words) {
        if (dictionary.wordFrequencies.has(word)) {
          validWordCount++;
        }
      }
      
      // More lenient threshold for celebrity quotes
      if (validWordCount > 0 && validWordCount / words.size >= 0.2) {
        solutions.set(plaintext, {
          meanFrequency: computeMeanFrequency(plaintext, dictionary),
          cipher: baseCipher
        });
        
        if (solutions.size >= maxSolutionCount) {
          break;
        }
      }
      
      // Try permutations of the base cipher
      const permutationAttempts = Math.min(100, (timeoutMs - (Date.now() - startTimeMs)) / 10);
      for (let i = 0; i < permutationAttempts; i++) {
        if (Date.now() - startTimeMs >= timeoutMs || solutions.size >= maxSolutionCount) {
          break;
        }
        
        // Create a modified cipher by swapping some letters
        const modifiedCipher = new Map(baseCipher);
        
        // Swap a few letters randomly
        const swapCount = Math.min(5, sortedCipherLetters.length / 2);
        for (let j = 0; j < swapCount; j++) {
          if (sortedCipherLetters.length < 2) continue;
          
          const index1 = Math.floor(Math.random() * sortedCipherLetters.length);
          const index2 = Math.floor(Math.random() * sortedCipherLetters.length);
          
          if (index1 !== index2) {
            const letter1 = sortedCipherLetters[index1];
            const letter2 = sortedCipherLetters[index2];
            
            if (!letter1 || !letter2) continue;
            
            if (!modifiedCipher.has(letter1) || !modifiedCipher.has(letter2)) continue;
            
            const value1 = modifiedCipher.get(letter1);
            const value2 = modifiedCipher.get(letter2);
            
            if (!value1 || !value2) continue;
            
            modifiedCipher.set(letter1, value2);
            modifiedCipher.set(letter2, value1);
          }
        }
        
        const modifiedPlaintext = decryptCiphertext(ciphertext, modifiedCipher);
        
        if (modifiedPlaintext) {
          // Check if this produces valid words
          const modifiedWords = parseWords(modifiedPlaintext, dictionary.alphabet);
          let modifiedValidWordCount = 0;
          
          for (const word of modifiedWords) {
            if (dictionary.wordFrequencies.has(word)) {
              modifiedValidWordCount++;
            }
          }
          
          // More lenient threshold for celebrity quotes
          if (modifiedValidWordCount > 0 && modifiedValidWordCount / modifiedWords.size >= 0.2) {
            solutions.set(modifiedPlaintext, {
              meanFrequency: computeMeanFrequency(modifiedPlaintext, dictionary),
              cipher: modifiedCipher
            });
            
            if (solutions.size >= maxSolutionCount) {
              break;
            }
          }
        }
      }
    }
  }
  
  return solutions;
}

export default solveCryptogram
