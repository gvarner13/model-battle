import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Check,
  CircleAlert,
  Cloud,
  ImagePlus,
  Info,
  LoaderCircle,
  PawPrint,
  Scan,
  ShieldCheck,
  Sparkles,
  Square,
  Upload,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import { MODELS } from '../lib/models'
import type { Classification, ModelKey, ModelResult } from '../lib/models'
import { prepareImage } from '../lib/image'
import { readResults } from '../lib/stream'

export const Route = createFileRoute('/')({ component: Home })
type Photo = { blob: Blob; url: string; name: string }
type Results = Partial<Record<ModelKey, ModelResult>>
const CATEGORY_ICONS = { animal: PawPrint, human: UserRound, object: Square }

function Home() {
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [running, setRunning] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<Results>({})
  const input = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)
  const selectionId = useRef(0)
  const help = useRef<HTMLDialogElement>(null)
  const completed = Object.keys(results).length
  const successful = Object.values(results).filter((result) => result.status === 'success').length

  useEffect(
    () => () => {
      abort.current?.abort()
    },
    [],
  )
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url)
    },
    [photo],
  )

  async function selectPhoto(file: File) {
    const id = ++selectionId.current
    abort.current?.abort()
    setRunning(false)
    setPreparing(true)
    setError('')
    setResults({})
    try {
      const blob = await prepareImage(file)
      if (id === selectionId.current)
        setPhoto({ blob, url: URL.createObjectURL(blob), name: file.name })
    } catch (e) {
      if (id === selectionId.current)
        setError(e instanceof Error ? e.message : 'Could not open this photo.')
    } finally {
      if (id === selectionId.current) setPreparing(false)
    }
  }

  async function samplePhoto() {
    setError('')
    try {
      const response = await fetch('/examples/cat.jpg')
      if (!response.ok) throw new Error('Could not load the sample photo.')
      await selectPhoto(
        new File([await response.blob()], 'curious-cat.jpg', { type: 'image/jpeg' }),
      )
    } catch {
      setError('Could not load the sample photo. Try uploading your own.')
    }
  }

  function removePhoto() {
    ++selectionId.current
    abort.current?.abort()
    setRunning(false)
    setPhoto(null)
    setPreparing(false)
    setResults({})
    setError('')
  }

  async function analyze() {
    if (!photo || running || preparing) return
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setRunning(true)
    setError('')
    setResults({})
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': photo.blob.type },
        body: photo.blob,
        signal: controller.signal,
      })
      await readResults(response, (event) => {
        if (!('done' in event) && !controller.signal.aborted) {
          setResults((previous) => ({ ...previous, [event.key]: event }))
        }
      })
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      if (abort.current === controller) setRunning(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a href="/" className="wordmark" aria-label="Model Battle home">
          <span className="brand-icon">
            <Scan size={21} strokeWidth={1.7} />
          </span>
          model<span className="wordmark-light">battle</span>
          <span className="beta-label">LAB</span>
        </a>
        <div className="header-right">
          <span className="header-label">
            <span className="status-dot" /> A little experiment in AI vision
          </span>
          <button className="help-button" onClick={() => help.current?.showModal()}>
            <Info size={15} /> How it works
          </button>
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="small-line" /> THE IMAGE ARENA
            </div>
            <h1 id="page-title">
              One photo.
              <br />
              Four <span className="serif-word">perspectives.</span>
            </h1>
            <p>
              What do AI models see when they look at the same photo?
              <br className="desktop-break" /> Drop one in. Let them take a look. Compare the
              answers.
            </p>
          </div>
          <div className="hero-aside" aria-hidden="true">
            <div className="perspective-art">
              <span className="art-frame frame-one" />
              <span className="art-frame frame-two" />
              <span className="art-frame frame-three" />
              <Scan size={42} strokeWidth={1} />
            </div>
            <span>One input. Independent opinions.</span>
          </div>
        </section>

        <div className="workspace">
          <section className="input-section" aria-labelledby="input-heading">
            <div className="section-heading">
              <h2 id="input-heading">
                <span>01</span> Your photo
              </h2>
              <span className="section-meta">THE COMMON GROUND</span>
            </div>
            <div className="upload-card">
              <input
                ref={input}
                id="photo-input"
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Choose a photo"
                disabled={preparing || running}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void selectPhoto(file)
                  event.target.value = ''
                }}
              />
              {photo ? (
                <div className="photo-preview">
                  <img src={photo.url} alt="Your selected photo for the model comparison" />
                  <button className="remove-photo" aria-label="Remove photo" onClick={removePhoto}>
                    <X size={17} />
                  </button>
                  <span className="photo-label">
                    <Check size={13} /> Ready for a closer look
                  </span>
                </div>
              ) : (
                <button
                  className={`dropzone ${dragging ? 'dragging' : ''}`}
                  disabled={preparing}
                  onClick={() => input.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    const file = event.dataTransfer.files[0]
                    if (file) void selectPhoto(file)
                  }}
                >
                  <span className="upload-illustration">
                    {preparing ? (
                      <LoaderCircle className="spin" size={34} strokeWidth={1.3} />
                    ) : (
                      <ImagePlus size={37} strokeWidth={1.2} />
                    )}
                    <span className="illustration-spark">✦</span>
                  </span>
                  <span className="dropzone-title">
                    {preparing
                      ? 'Getting your photo ready…'
                      : dragging
                        ? 'A good place to drop it.'
                        : 'A photo is worth four opinions.'}
                  </span>
                  <span className="dropzone-description">Drag & drop your photo here, or</span>
                  <span className="browse-button">
                    <Upload size={14} /> Choose a photo
                  </span>
                  <span className="file-hint">JPG, PNG or WebP · up to 20 MB</span>
                </button>
              )}
              <div className="upload-caption">
                {photo ? (
                  <>
                    <span className="filename">{photo.name}</span>
                    <button
                      className="text-button"
                      disabled={preparing || running}
                      onClick={() => input.current?.click()}
                    >
                      Change photo <ArrowRight size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span>Just looking around?</span>
                    <button
                      className="sample-button"
                      disabled={preparing}
                      onClick={() => void samplePhoto()}
                    >
                      <img src="/examples/cat.jpg" alt="" /> Try a sample <ArrowRight size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <button
              className="compare-button"
              onClick={() => void analyze()}
              disabled={!photo || running || preparing}
            >
              {running ? (
                <>
                  <LoaderCircle size={17} className="spin" /> Looking through four lenses…{' '}
                  <span className="button-progress">{completed}/4</span>
                </>
              ) : (
                <>
                  <Sparkles size={17} /> {completed ? 'Compare again' : 'Compare perspectives'}
                  <ArrowRight size={17} className="button-arrow" />
                </>
              )}
            </button>
            {running ? (
              <button
                className="cancel-button"
                onClick={() => {
                  abort.current?.abort()
                  setRunning(false)
                }}
              >
                Stop waiting
              </button>
            ) : null}
            <p className="privacy-note">
              <ShieldCheck size={14} />
              <span>
                Resized in your browser. Never saved by this app.
                <br />
                Sent to Cloudflare and the three model providers for analysis.
              </span>
            </p>
            {error ? (
              <div className="error-message" role="alert">
                <CircleAlert size={17} />
                <span>{error}</span>
              </div>
            ) : null}
            {completed > 0 && !running ? (
              <p className="completion-note" role="status">
                {successful} of 4 models responded successfully.{' '}
                {successful < 4
                  ? 'You can try another comparison.'
                  : 'Different answers are part of the experiment.'}
              </p>
            ) : null}
          </section>

          <section
            className="perspectives-section"
            aria-labelledby="perspectives-heading"
            aria-busy={running}
          >
            <div className="section-heading">
              <h2 id="perspectives-heading">
                <span>02</span> The perspectives
              </h2>
              <span className="section-meta">
                <span className="mini-dot" /> THREE VISION MODELS
              </span>
            </div>
            <div className="model-cards" aria-live="polite">
              {MODELS.map((model, index) => (
                <ModelCard
                  key={model.key}
                  model={model}
                  result={results[model.key]}
                  running={running}
                  index={index}
                />
              ))}
            </div>
            <p className="results-footnote">
              <Zap size={12} /> Runs in parallel. No model sees another model’s answer.
            </p>
          </section>
        </div>

        <section
          className="classifier-section"
          aria-labelledby="classifier-heading"
          aria-busy={running}
        >
          <div className="section-heading">
            <h2 id="classifier-heading">
              <span>03</span> The quick classification
            </h2>
            <span className="section-meta">A DIFFERENT KIND OF LENS</span>
          </div>
          <div className="classifier-panel">
            <div className="classifier-intro">
              <span className="clairic-icon">
                <Cloud size={23} strokeWidth={1.5} />
              </span>
              <div>
                <h3>
                  Cloudflare Clairic <span>PREVIEW</span>
                </h3>
                <p>Less description. More distinction.</p>
                <code>@cf/cloudflare/clairic</code>
              </div>
            </div>
            <div className="categories" aria-live="polite">
              {(['animal', 'human', 'object'] as const).map((category) => (
                <CategoryCard
                  key={category}
                  category={category}
                  classification={results.clairic?.classifications?.find(
                    (item) => item.category === category,
                  )}
                  running={running && !results.clairic}
                  failed={results.clairic?.status === 'error'}
                />
              ))}
            </div>
          </div>
          {results.clairic?.error ? (
            <p className="classifier-error" role="alert">
              <CircleAlert size={13} />
              {results.clairic.error}
            </p>
          ) : null}
          <div className="classifier-caption">
            <span>
              Categories can overlap. Confidence reflects Clairic’s answer, not a guarantee.
            </span>
            <span>
              {results.clairic
                ? formatTime(results.clairic.elapsedMs) + ' elapsed'
                : 'Typed answers. Model-reported confidence.'}
            </span>
          </div>
        </section>

        <section className="experiment-note">
          <span className="note-icon">
            <Info size={17} />
          </span>
          <p>
            <strong>Different models. Different ways of seeing.</strong> This is a comparison, not a
            verdict. AI can miss details, disagree, or confidently get things wrong.
          </p>
          <ArrowDown size={17} className="note-arrow" />
        </section>
      </main>

      <footer>
        <span className="footer-credit">
          <Cloud size={15} /> Built on Cloudflare Workers <span className="footer-divider">/</span>{' '}
          Routed through AI Gateway
        </span>
        <span>One photo. A fresh perspective.</span>
      </footer>

      <dialog
        ref={help}
        className="help-dialog"
        aria-labelledby="help-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) help.current?.close()
        }}
      >
        <div className="dialog-heading">
          <span className="eyebrow">BEHIND THE EXPERIMENT</span>
          <button
            className="icon-button"
            aria-label="Close explanation"
            onClick={() => help.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="help-title">Four independent looks.</h2>
        <ol>
          <li>
            <strong>Pick a photo.</strong> Your browser resizes it to a maximum of 1,600 pixels,
            re-encodes it as JPEG, and strips its original metadata.
          </li>
          <li>
            <strong>Compare.</strong> A Cloudflare Worker sends the same photo to GPT-6 Luna, Claude
            Haiku 5.5, Gemini 3.8 Flash, and Clairic, in parallel through AI Gateway.
          </li>
          <li>
            <strong>See the differences.</strong> Three models describe the photo; Clairic
            independently detects animals, humans, and objects with model-reported confidence.
          </li>
        </ol>
        <p>
          There is no automatic winner. Timings include network and provider latency, and are not a
          controlled benchmark. Gateway content logging and caching are disabled for these requests.
          This app does not store photos; Cloudflare and upstream provider data policies still
          apply.
        </p>
        <p className="dialog-footnote">
          Each comparison makes four inference calls and may incur charges. Limited to five
          comparisons per minute per IP at each Cloudflare location. Add authentication or
          Cloudflare Access before sharing broadly.
        </p>
        <button className="compare-button" onClick={() => help.current?.close()}>
          Got it <Check size={17} />
        </button>
      </dialog>
    </div>
  )
}

function formatTime(ms: number) {
  return (ms / 1000).toFixed(1) + 's'
}

function ModelCard({
  model,
  result,
  running,
  index,
}: {
  model: (typeof MODELS)[number]
  result?: ModelResult
  running: boolean
  index: number
}) {
  const waiting = running && !result
  return (
    <article className={`model-card ${result?.status === 'error' ? 'model-error' : ''}`}>
      <div className="model-card-top">
        <div className="model-identity">
          <span className={`provider-icon ${model.color}`}>
            {model.key === 'google' ? (
              <Sparkles size={18} strokeWidth={1.7} />
            ) : model.key === 'anthropic' ? (
              <span className="anthropic-mark">
                A<span>╱</span>
              </span>
            ) : (
              <span className="openai-mark">◎</span>
            )}
          </span>
          <div>
            <h3>{model.name}</h3>
            <span>{model.provider}</span>
          </div>
        </div>
        <span
          className={`model-status ${waiting ? 'is-waiting' : result?.status === 'success' ? 'is-done' : ''}`}
        >
          {waiting ? (
            <>
              <LoaderCircle size={11} className="spin" /> Looking
            </>
          ) : result?.status === 'success' ? (
            <>
              <Check size={11} /> {formatTime(result.elapsedMs)}
            </>
          ) : result?.status === 'error' ? (
            <>
              <CircleAlert size={11} /> Unavailable
            </>
          ) : (
            <>
              <span className="mini-dot" /> Standing by
            </>
          )}
        </span>
      </div>
      {result?.description ? (
        <p className="model-description">{result.description}</p>
      ) : result?.error ? (
        <p className="model-error-text">{result.error}</p>
      ) : waiting ? (
        <div className="skeleton-lines" aria-label={`${model.name} is analyzing the photo`}>
          <span />
          <span />
          <span />
        </div>
      ) : (
        <div className="empty-answer">
          <span className="answer-number">0{index + 1}</span>
          <p>A fresh set of eyes, waiting for your photo.</p>
        </div>
      )}
      <div className="model-card-bottom">
        <code>{model.id}</code>
        <span>
          VISION <Scan size={11} />
        </span>
      </div>
    </article>
  )
}

function CategoryCard({
  category,
  classification,
  running,
  failed,
}: {
  category: Classification['category']
  classification?: Classification
  running: boolean
  failed: boolean
}) {
  const Icon = CATEGORY_ICONS[category]
  const present = classification?.present
  return (
    <div className={`category-card ${present === true ? 'category-detected' : ''}`}>
      <div className="category-top">
        <Icon size={16} strokeWidth={1.6} />
        <h4>{category}</h4>
        {running ? (
          <LoaderCircle size={12} className="spin" />
        ) : present === true ? (
          <Check size={13} />
        ) : null}
      </div>
      <div className="category-value">
        {running
          ? 'Looking…'
          : failed
            ? 'Unavailable'
            : !classification
              ? '—'
              : present === true
                ? 'Detected'
                : present === false
                  ? 'Not detected'
                  : 'Uncertain'}
      </div>
      <div className="confidence-track">
        <span style={{ width: `${(classification?.confidence ?? 0) * 100}%` }} />
      </div>
      <span className="confidence-label">
        {classification?.confidence != null
          ? `${Math.round(classification.confidence * 100)}% confidence in answer`
          : failed
            ? 'No classification returned'
            : classification
              ? 'No confidence returned'
              : 'Awaiting classification'}
      </span>
    </div>
  )
}
