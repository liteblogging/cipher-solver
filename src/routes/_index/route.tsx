import { json } from '@remix-run/node'
import type { ActionFunctionArgs, LinksFunction } from '@remix-run/node'
import { z } from 'zod'
import { getFormProps, getTextareaProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { map, pipe, reduce, toArray } from 'lfi'
import {
  Form,
  useActionData,
  useNavigation,
  useRevalidator,
} from '@remix-run/react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useSpinDelay } from 'spin-delay'
import { createPortal } from 'react-dom'
import loadingSvgPath from './loading.svg'
import solveCryptogram from '~/services/cryptogram.server.ts'
import { readDictionary } from '~/services/dictionary.server.ts'

const IndexPage = () => (
  <div className='relative flex flex-1 flex-col overflow-hidden px-4 sm:px-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white'>
    <Main />
  </div>
)

const Main = () => (
  <main className='z-10 flex flex-1 flex-col items-center justify-center py-8 sm:py-10 w-full max-w-4xl mx-auto'>
    <Header />
    <Solver />
  </main>
)

const Header = () => (
  <header className='flex flex-col items-center mb-6'>
    <h1 className='text-3xl font-bold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 sm:text-4xl'>
      CipherSolver
    </h1>
    <p className='text-center text-slate-300 mt-2 max-w-md'>
      Decrypt and solve cryptograms instantly
    </p>
  </header>
)

const Solver = () => {
  const { submission, solutions } = useActionData<typeof action>() ?? {}
  const [form, fields] = useForm({
    lastResult: submission,
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: formSchema }),
    constraint: getZodConstraint(formSchema),
  })
  const isSubmitting = useIsSubmitting()
  const preventSolvingIfSubmitting = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    e => {
      if (isSubmitting) {
        e.preventDefault()
      }
    },
    [isSubmitting],
  )
  const [extendedTimeout, setExtendedTimeout] = useState(false);

  return (
    <Form
      method='post'
      {...getFormProps(form)}
      className='flex w-full flex-1 flex-col items-center gap-4'
    >
      <div className='flex w-full flex-1 flex-col gap-2'>
        <label htmlFor={fields.ciphertext.id} className="text-slate-300 font-medium">Enter Your Cryptogram</label>
        <div className='relative flex flex-1'>
          <textarea
            {...getTextareaProps(fields.ciphertext)}
            placeholder='Type or paste your cryptogram here...'
            className='w-full resize-none rounded-lg border-0 bg-slate-700 bg-opacity-50 p-4 text-white placeholder-slate-400 min-h-[150px] ring-cyan-400 focus:ring-2 focus-visible:outline-none'
          />
          {solutions ? (
            <Solutions
              ciphertext={fields.ciphertext.value!}
              solutions={solutions}
            />
          ) : null}
          {isSubmitting ? <Loading /> : null}
        </div>
      </div>
      <div className='flex flex-wrap gap-3 items-center justify-center mt-2'>
        <button
          type='submit'
          onClick={preventSolvingIfSubmitting}
          aria-disabled={isSubmitting}
          className='rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-2.5 font-medium text-white shadow-lg hover:from-cyan-600 hover:to-purple-700 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95 disabled:opacity-70'
        >
          Solve Now
        </button>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input 
            type="checkbox" 
            name="extendedTimeout" 
            checked={extendedTimeout}
            onChange={() => setExtendedTimeout(!extendedTimeout)}
            className="w-4 h-4 rounded accent-cyan-500 focus:ring-cyan-400"
          />
          Advanced mode for complex ciphers
        </label>
      </div>
      {fields.ciphertext.errors && (
        <div id={fields.ciphertext.errorId} className="text-red-400 text-sm mt-1">{fields.ciphertext.errors}</div>
      )}
    </Form>
  )
}

const useIsSubmitting = () => {
  const navigation = useNavigation()
  const isSubmitting = useSpinDelay(navigation.state === `submitting`)
  return isSubmitting
}

const Loading = () => {
  const magnifyingFilterId = useId()
  return (
    <div className='absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-75 rounded-lg backdrop-blur-sm'>
      <span role='alert' className='text-xl font-medium text-white'>
        Decrypting...
      </span>
      <div className='absolute left-1/2 top-1/2 -translate-y-6'>
        <div className='relative inline-block animate-back-and-forth'>
          <div
            className='absolute right-0 top-0 -z-10 h-[52px] w-[52px] rounded-full'
            style={{ backdropFilter: `url(#${magnifyingFilterId})` }}
          />
          <img src={loadingSvgPath} alt='' />
        </div>
        <svg
          width='100%'
          xmlns='http://www.w3.org/2000/svg'
          preserveAspectRatio='none'
        >
          <defs>
            <filter id={magnifyingFilterId} colorInterpolationFilters='sRGB'>
              <feImage
                href="data:image/svg+xml,%3Csvg width='128' height='128' viewBox='0 0 128 128' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-path='url(%23clip0_728_2)'%3E%3Crect width='128' height='128' fill='black'/%3E%3Cg style='mix-blend-mode:screen'%3E%3Crect width='128' height='128' fill='url(%23paint0_linear_728_2)'/%3E%3C/g%3E%3Cg style='mix-blend-mode:screen'%3E%3Crect width='128' height='128' fill='url(%23paint1_linear_728_2)'/%3E%3C/g%3E%3C/g%3E%3Cdefs%3E%3ClinearGradient id='paint0_linear_728_2' x1='0' y1='0' x2='128' y2='0' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23FF0000'/%3E%3Cstop offset='1' stop-color='%23FF0000' stop-opacity='0'/%3E%3C/linearGradient%3E%3ClinearGradient id='paint1_linear_728_2' x1='0' y1='0' x2='0' y2='128' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%230000FF'/%3E%3Cstop offset='1' stop-color='%230000FF' stop-opacity='0'/%3E%3C/linearGradient%3E%3CclipPath id='clip0_728_2'%3E%3Crect width='128' height='128' fill='white'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E%0A"
                result='i'
              />
              <feDisplacementMap
                in='SourceGraphic'
                in2='i'
                xChannelSelector='R'
                yChannelSelector='B'
                scale='25'
              />
            </filter>
          </defs>
        </svg>
      </div>
    </div>
  )
}

const Solutions = ({
  ciphertext,
  solutions,
}: {
  ciphertext: string
  solutions: Solution[]
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  useEffect(() => {
    dialogRef.current!.showModal()
  }, [])

  const { revalidate } = useRevalidator()
  const stopDialogClosePropagation = useCallback<
    React.FormEventHandler<HTMLFormElement>
  >(e => e.stopPropagation(), [])

  const [solutionIndex, setSolutionIndex] = useState(0)
  const decrementSolutionIndex = useCallback(
    () => setSolutionIndex(solutionIndex => Math.max(0, solutionIndex - 1)),
    [],
  )
  const incrementSolutionIndex = useCallback(
    () =>
      setSolutionIndex(solutionIndex =>
        Math.min(solutionIndex + 1, solutions.length - 1),
      ),
    [solutions.length],
  )

  return createPortal(
    <dialog
      ref={dialogRef}
      className='flex flex-col space-y-5 rounded-xl border-0 bg-slate-800 p-6 sm:p-8 text-white backdrop:bg-slate-950 backdrop:bg-opacity-90 max-w-[90vw] sm:max-w-[600px] shadow-2xl'
      onClose={revalidate}
    >
      <div className='flex items-center'>
        <h2 className="text-xl font-bold text-cyan-400">Results</h2>
        <form
          method='dialog'
          className='ml-auto flex'
          onSubmit={stopDialogClosePropagation}
        >
          <button
            type='submit'
            className='text-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-full'
          >
            <CloseIcon />
          </button>
        </form>
      </div>
      
      {solutions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="bg-slate-700 p-4 rounded-lg text-slate-200 mb-4">
            <p className='text-xl mb-2'>No solution found</p>
            <p>
              Try checking for typos in your input or try a different cryptogram.
            </p>
            <small className='block mt-4 text-slate-400 text-xs'>
              For best results, provide longer texts with multiple words to give the solver more context.
              <br />
              For celebrity quotes, enable the "Advanced mode" option.
            </small>
          </div>
        </div>
      ) : (
        <div className='flex flex-1 flex-col justify-center space-y-5'>
          <div className='space-y-6 overflow-auto'>
            <div className="bg-slate-700 bg-opacity-50 p-4 rounded-lg text-slate-300">
              <h3 className="text-xs uppercase tracking-wider text-slate-400 mb-1">Original Cryptogram</h3>
              <p className='text-white'>{ciphertext}</p>
            </div>
            
            <div className="bg-slate-700 bg-opacity-30 p-4 rounded-lg text-center">
              <h3 className="text-xs uppercase tracking-wider text-slate-400 mb-2">Cipher Key</h3>
              <CipherTable cipher={solutions[solutionIndex]!.cipher} />
            </div>
            
            <div className="bg-cyan-900 bg-opacity-30 p-4 rounded-lg">
              <h3 className="text-xs uppercase tracking-wider text-cyan-300 mb-1">Decrypted Solution</h3>
              <p className='text-cyan-50 font-medium'>{solutions[solutionIndex]!.plaintext}</p>
            </div>
          </div>
          
          {solutions.length > 1 && (
            <nav className='flex items-center justify-center gap-3 pt-2'>
              <button
                type='button'
                onClick={decrementSolutionIndex}
                aria-disabled={solutionIndex === 0}
                className='h-8 w-8 flex items-center justify-center rounded-full bg-slate-700 text-white hover:bg-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-40'
              >
                <ChevronLeftIcon />
              </button>
              <div className='text-sm text-slate-300'>
                Solution {solutionIndex + 1} of {solutions.length}
              </div>
              <button
                type='button'
                onClick={incrementSolutionIndex}
                aria-disabled={solutionIndex === solutions.length - 1}
                className='h-8 w-8 flex items-center justify-center rounded-full bg-slate-700 text-white hover:bg-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-40'
              >
                <ChevronRightIcon />
              </button>
            </nav>
          )}
        </div>
      )}
    </dialog>,
    document.body,
  )
}

const CloseIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='currentColor'
    className='h-6 w-6'
    aria-label='Close'
  >
    <path
      fillRule='evenodd'
      d='M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z'
      clipRule='evenodd'
    />
  </svg>
)

const CipherTable = ({ cipher }: { cipher: Solution[`cipher`] }) => (
  <div className="overflow-x-auto">
    <table className='mx-auto border-collapse'>
      <thead>
        <tr>
          {Object.keys(cipher).map(ciphertextLetter => (
            <th key={ciphertextLetter} className='px-2 py-1 text-cyan-300 font-medium'>
              {ciphertextLetter}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {Object.values(cipher).map(plaintextLetter => (
            <td key={plaintextLetter} className='px-2 py-1 text-white font-bold'>
              {plaintextLetter}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  </div>
)

const ChevronLeftIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='currentColor'
    className='h-5 w-5'
    aria-label='Previous'
  >
    <path
      fillRule='evenodd'
      d='M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z'
      clipRule='evenodd'
    />
  </svg>
)

const ChevronRightIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='currentColor'
    className='h-5 w-5'
    aria-label='Next'
  >
    <path
      fillRule='evenodd'
      d='M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z'
      clipRule='evenodd'
    />
  </svg>
)

export const links: LinksFunction = () => [
  // Preload the loading SVG so avoid a flicker on the first use of solve.
  { rel: `preload`, as: `image`, href: loadingSvgPath },
]

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: formSchema })
  if (submission.status !== `success`) {
    return json({ submission: submission.reply(), solutions: null })
  }

  const extendedTimeout = formData.get('extendedTimeout') === 'on';
  return json({
    submission: submission.reply(),
    solutions: await trySolveCryptogram(submission.value.ciphertext, extendedTimeout),
  })
}

const trySolveCryptogram = async (ciphertext: string, extendedTimeout: boolean = false): Promise<Solution[]> => {
  const dictionary = await readDictionary()
  const solutions = solveCryptogram({
    ciphertext,
    dictionary,
    maxSolutionCount: 5,
    timeoutMs: extendedTimeout ? 60000 : 15000,
  })
  return pipe(
    solutions,
    map(([plaintext, cipher]) => ({
      plaintext,
      cipher: Object.fromEntries(cipher),
    })),
    reduce(toArray()),
  )
}

type Solution = { plaintext: string; cipher: Record<string, string> }

const formSchema = z.object({
  ciphertext: z.string({
    required_error: `Please enter your cryptogram text!`,
  }),
})

export default IndexPage
