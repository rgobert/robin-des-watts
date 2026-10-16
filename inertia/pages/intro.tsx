import { Link } from '@adonisjs/inertia/react'
import {
  Car,
  Coins,
  House,
  PiggyBank,
  Share2,
  ShieldCheck,
  Sun,
  TreeDeciduous,
  Trees,
  Zap,
} from 'lucide-react'
import { MotionConfig, motion, useInView, type Variants } from 'motion/react'
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { track, trackOnce, useTrackOnce } from '~/components/use_track'
import {
  ActionButton,
  AnimatedNumber,
  GoalRing,
  TrophyShelf,
  YearCalendar,
  cx,
  useToast,
  type Trophy,
} from '~/kit'
import { EuroCounter } from '~/kit/components/euro_counter'
import { duration, ease, fadeUp, pressable, softSpring, stagger } from '~/kit/motion'
import type { InertiaProps } from '~/types'

type PageProps = InertiaProps<{
  firstName: string
  priceHikeEur: number
  rewardPotentialEur: number
  zeroGridDays: number
  longestStreak: { length: number; start: string; end: string }
  recordDay: { date: string; production: number }
  recordSavingsDay: { date: string; savings: number }
  virtualBatteryNetEur: number
  surplusResaleEur: number
  productionKwh: number
  selfConsumptionRate: number
  autonomyRate: number
  co2: { avoidedKg: number; carKm: number; trees: number }
  days: { date: string; productionKwh: number; savingsEur: number; zeroGrid: boolean }[]
  profile: { visitorId: string; prenom: string; ville: string; variante: 'euros' | 'impact' }
  /** `?slide=` of a shared link: the story opens on that slide. */
  startSlide: string | null
}>

/** Deux lectures de la même année : « portefeuille » (euros) ou « planète » (impact). */
type Lens = 'euros' | 'impact'

/** One story slide: `dark` slides (primary, win) switch the progress bar to light segments. */
type StorySlide = { id: string; dark?: boolean; node: ReactNode }

/** Share of a slide that must be on screen to play its entrance and count as seen. */
const SEEN = 0.6

/** Hero number: scales in from 0.8 on a soft spring when its slide is reached. */
const pop: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1, transition: softSpring },
}

/** Decorative shape drifting in once from off-screen (no loop). */
const drift: Variants = {
  hidden: { opacity: 0, x: 160 },
  show: { opacity: 1, x: 0, transition: { duration: duration.story, ease: ease.out } },
}

/** Top padding leaves room for the progress bar and the lens toggle pinned above the slides. */
const slideClass =
  'relative isolate flex h-[100svh] w-full shrink-0 snap-center flex-col justify-center gap-4 overflow-hidden px-6 pt-28 pb-12'

/** Splits an existing string into words that slide up one by one (60 ms stagger). */
function Words({
  text,
  className,
  delay = 0,
}: {
  text: string
  className?: string
  delay?: number
}) {
  const words = text.split(' ')
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: delay } },
  }
  return (
    <motion.span variants={variants} className={className}>
      {/* L’espace reste hors du inline-block : à l’intérieur, il est avalé et les mots se collent. */}
      {words.map((word, i) => (
        <Fragment key={i}>
          <motion.span variants={fadeUp} className="inline-block">
            {word}
          </motion.span>
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </motion.span>
  )
}

/** Full-screen story slide: plays its choreography once when it is really on screen. */
function Slide({
  className,
  shape,
  label,
  children,
}: {
  className: string
  shape: string
  label?: string
  children: ReactNode
}) {
  return (
    <motion.section
      aria-label={label}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: SEEN }}
      variants={stagger(0.08)}
      className={`${slideClass} ${className}`}
    >
      <motion.span
        aria-hidden
        variants={drift}
        className={`pointer-events-none absolute -top-16 -right-24 -z-10 size-72 rotate-12 rounded-[3rem] blur-2xl ${shape}`}
      />
      {children}
    </motion.section>
  )
}

/** Retro card that reports `carte_vue` the first time it is on screen. */
function RetroCard({
  id,
  className,
  shape,
  children,
}: {
  id: string
  className: string
  shape: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, amount: SEEN })
  useEffect(() => {
    if (inView) trackOnce(`carte:${id}`, 'carte_vue', { carte: id })
  }, [inView, id])
  return (
    <motion.article
      ref={ref}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: SEEN }}
      variants={stagger(0.08)}
      className={`${slideClass} ${className}`}
    >
      <motion.span
        aria-hidden
        variants={drift}
        className={`pointer-events-none absolute -bottom-20 -left-24 -z-10 size-80 rounded-full blur-3xl ${shape}`}
      />
      {children}
    </motion.article>
  )
}

/** Insta-style segments: previous ones full, the active one fills, next ones empty. No timer. */
function StoryProgress({ active, count, dark }: { active: number; count: number; dark: boolean }) {
  return (
    <div aria-hidden className="flex gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-0.5 flex-1 overflow-hidden rounded-full ${dark ? 'bg-surface/35' : 'bg-ink/15'}`}
        >
          <motion.span
            initial={false}
            animate={{ scaleX: i <= active ? 1 : 0 }}
            transition={{ duration: i === active ? duration.slow : duration.fast, ease: ease.out }}
            className={`block h-full origin-left ${dark ? 'bg-surface' : 'bg-ink/70'}`}
          />
        </span>
      ))}
    </div>
  )
}

/** Slides actually rendered, read from the scroller (the list changes with the lens). */
const slideCount = (node: HTMLElement) => Math.round(node.scrollWidth / node.clientWidth)

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
const num = (n: number, decimals = 0) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
/** Arrondi d’affichage des montants de la rétro : plancher à 50 €, comme la valeur nette. */
const round50 = (n: number) => Math.floor(n / 50) * 50

const hero = 'text-6xl leading-none font-semibold tracking-tight tabular-nums'
const eyebrow = 'flex items-center gap-2 text-sm font-semibold'

/**
 * Écran 1 : la hausse du 1/11 en premier, puis l’année racontée dans la lecture choisie.
 * Chiffres : année anniversaire (15/10/2025 → 14/10/2026), prix année 1.
 * Friction traitée : une rétrospective en liste se survole ; en story horizontale, un chiffre à la fois,
 * au rythme de Claire (swipe, tap à droite / à gauche, flèches), la barre dit où on en est et combien il en reste.
 * Personae : la bascule « Économies / Impact », épinglée en haut, relit la même année en euros ou en
 * CO₂, arbres et soleil ; le calendrier, les trophées et le CTA suivent la lecture choisie, mémorisée
 * pour la visite suivante. Un seul trophée reste verrouillé : « Hausse compensée », dans l’année 2.
 */
export default function Intro(props: PageProps) {
  useTrackOnce('page:retro', 'page_vue', { page: 'retro' })
  useTrackOnce('hausse', 'hausse_vue', { delta_eur: props.priceHikeEur })
  const container = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  // A/B test: one sticky variant per visitor, assigned server-side. No visible switch: it would bias the test.
  const lens: Lens = props.profile.variante
  const share = useShareRetro(props, lens)

  const slides = buildSlides(props, lens)
  const count = slides.length

  const goTo = (index: number, behavior: ScrollBehavior = 'smooth') => {
    const node = container.current
    if (!node) return
    const target = Math.max(0, Math.min(slideCount(node) - 1, index))
    node.scrollTo({ left: target * node.clientWidth, behavior })
  }

  // Lien partagé (`?slide=`) : la story s’ouvre sur cette slide, sans défilement visible ; si la
  // slide n’existe pas dans la lecture du visiteur, sur la 1re carte de sa lecture.
  useLayoutEffect(() => {
    const node = container.current
    if (!props.startSlide || !node) return
    const index = slides.findIndex((s) => s.id === props.startSlide)
    const target = index >= 0 ? index : 2
    setActive(target)
    node.style.scrollSnapType = 'none'
    node.scrollLeft = target * node.clientWidth
    const frame = requestAnimationFrame(() => {
      node.style.scrollSnapType = ''
      node.scrollLeft = target * node.clientWidth
    })
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onScroll = () => {
    const node = container.current
    if (node) setActive(Math.round(node.scrollLeft / node.clientWidth))
  }

  // Tap zones: left third goes back, right two thirds go forward. Links and buttons keep their click.
  const onTap = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a,button,[data-no-tap]')) return
    const rect = event.currentTarget.getBoundingClientRect()
    goTo(event.clientX - rect.left < rect.width / 3 ? active - 1 : active + 1)
  }

  // Keyboard ← → for desktop and the projector (the lens toggle keeps its own arrows).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const node = container.current
      if (!node || (event.target as HTMLElement).closest?.('[role="radiogroup"]')) return
      const current = Math.round(node.scrollLeft / node.clientWidth)
      const next =
        event.key === 'ArrowRight' ? current + 1 : event.key === 'ArrowLeft' ? current - 1 : null
      if (next === null) return
      event.preventDefault()
      node.scrollTo({
        left: Math.max(0, Math.min(slideCount(node) - 1, next)) * node.clientWidth,
        behavior: 'smooth',
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <div className="bg-canvas text-ink">
        {/* Progression + partage de la slide, épinglés au-dessus de toutes les slides */}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-20 mx-auto flex max-w-md flex-col gap-3 px-4 pt-3">
          <StoryProgress active={active} count={count} dark={!!slides[active]?.dark} />
          {/* Partage de la slide affichée ; la slide finale a déjà son grand bouton. */}
          {slides[active] && slides[active].id !== 'cta' && (
            <motion.button
              type="button"
              {...pressable}
              onClick={() => share(slides[active].id)}
              aria-label="Partager cette slide"
              className="pointer-events-auto grid size-11 shrink-0 place-items-center self-end rounded-full bg-surface text-ink shadow-card ring-1 ring-line"
            >
              <Share2 className="size-5" aria-hidden />
            </motion.button>
          )}
        </div>
        <main
          ref={container}
          onScroll={onScroll}
          onClick={onTap}
          className="mx-auto flex h-[100svh] w-full max-w-md snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((s) => (
            <div key={s.id} className="contents">
              {s.node}
            </div>
          ))}
        </main>
      </div>
    </MotionConfig>
  )

  /** Slides in story order: intro, hausse, lecture choisie, série solaire, trophées, CTA. */
  function buildSlides(p: PageProps, l: Lens): StorySlide[] {
    const inEuros = l === 'euros'
    return [
      {
        id: 'intro',
        dark: true,
        node: (
          <Slide className="bg-primary text-primary-contrast" shape="bg-battery/60">
            <motion.header variants={fadeUp} className="flex flex-col gap-3">
              <p className="text-sm text-primary-contrast/80">
                Profil démo · {p.profile.prenom} · {p.profile.ville} · données de Claire Martin
              </p>
              <p className="text-sm text-primary-contrast/80">15 octobre 2026</p>
              <h1 className="text-5xl leading-tight font-semibold tracking-tight">
                <Words text={`Joyeux anniversaire, ${p.firstName}`} />
              </h1>
              <p className="text-2xl">
                <Words
                  text="Votre première année avec mylight150, en vrais chiffres."
                  delay={0.3}
                />
              </p>
            </motion.header>
            <motion.span
              aria-hidden
              className="absolute top-1/2 right-3 -translate-y-1/2 text-4xl leading-none text-primary-contrast/80"
              animate={{ x: [0, 6, 0] }}
              transition={{ duration: 1.6, ease: ease.inOut, repeat: Infinity }}
            >
              ›
            </motion.span>
          </Slide>
        ),
      },
      {
        id: 'hausse',
        node: (
          <Slide label="Hausse du 1er novembre" className="bg-hike-surface" shape="bg-hike/25">
            <motion.div variants={pop}>
              <EuroCounter
                value={-p.priceHikeEur}
                label="Le 1er novembre, vos prix augmentent"
                basis="sur vos achats au réseau de cette année"
              />
            </motion.div>
            <motion.p variants={fadeUp} className="text-sm text-ink-muted">
              Calculé sur ce que vous avez acheté au réseau cette année.
            </motion.p>
            <p className="text-2xl font-semibold">
              <Words text="…mais vous pouvez la compenser, gratuitement." delay={0.6} />
            </p>
          </Slide>
        ),
      },
      ...(inEuros ? eurosSlides(p) : impactSlides(p)),
      {
        id: 'jours_sans_reseau',
        node: (
          <RetroCard id="jours_sans_reseau" className="bg-sky" shape="bg-battery/40">
            <motion.p variants={fadeUp} className={`${eyebrow} text-ink`}>
              <Sun className="size-4 text-solar" aria-hidden /> Votre série solaire
            </motion.p>
            <motion.p variants={pop} className="text-5xl leading-none font-semibold tabular-nums">
              <AnimatedNumber value={p.zeroGridDays} suffix=" jours" />
            </motion.p>
            <p className="text-xl font-semibold">
              <Words
                text={
                  inEuros
                    ? 'sans payer un seul kWh au réseau'
                    : 'où votre maison a vécu 100 % de votre soleil'
                }
                delay={0.2}
              />
            </p>
            <motion.p variants={fadeUp} className="text-sm text-ink-muted">
              Dont {p.longestStreak.length} jours d’affilée, du {day(p.longestStreak.start)} au{' '}
              {day(p.longestStreak.end)}.
            </motion.p>
            <motion.div
              variants={fadeUp}
              data-no-tap
              className="rounded-lg bg-surface p-3 shadow-card"
            >
              <YearCalendar
                tone={inEuros ? 'reward' : 'solar'}
                markedLabel="jour sans réseau"
                defaultDate={inEuros ? p.recordSavingsDay.date : p.recordDay.date}
                format={(v) =>
                  inEuros ? `${num(v, 2)} € économisés` : `${num(v, 1)} kWh produits`
                }
                days={p.days.map((d) => ({
                  date: d.date,
                  value: inEuros ? d.savingsEur : d.productionKwh,
                  marked: d.zeroGrid,
                }))}
              />
              {inEuros && (
                <p className="mt-2 text-xs text-ink-muted">
                  Économie du jour avant abonnement et frais.
                </p>
              )}
            </motion.div>
          </RetroCard>
        ),
      },
      {
        id: 'trophees',
        node: (
          <RetroCard id="trophees" className="bg-canvas" shape="bg-sun/30">
            <motion.p variants={fadeUp} className="text-2xl font-semibold">
              Vos trophées de l’année
            </motion.p>
            <motion.div variants={fadeUp}>
              <TrophyShelf trophies={buildTrophies(p, l)} />
            </motion.div>
          </RetroCard>
        ),
      },
      {
        id: 'cta',
        node: (
          <Slide className="bg-win-surface" shape="bg-win/20">
            <motion.p variants={fadeUp} className="text-2xl font-semibold text-balance">
              {inEuros
                ? `Prochaine étape : compenser les ${Math.round(p.priceHikeEur)} € de hausse.`
                : 'Prochaine étape : vivre encore plus de votre soleil.'}
            </motion.p>
            <motion.div variants={fadeUp} {...pressable} className="flex flex-col">
              <Link
                route="next_year.render"
                className="rounded-full bg-primary px-8 py-5 text-center text-xl font-semibold text-primary-contrast"
              >
                Préparer mon année 2
              </Link>
            </motion.div>
            <motion.div variants={fadeUp} className="flex flex-col">
              <ActionButton
                variant="secondary"
                onClick={() => share('cta')}
                className="h-14 text-base"
              >
                Partager ma rétro
              </ActionButton>
            </motion.div>
          </Slide>
        ),
      },
    ]
  }
}

/**
 * Partage d’une slide de la rétro : feuille de partage
 * native, copie du lien sur desktop. Le texte suit la slide et la lecture affichées ; l’URL ne porte
 * qu’un UUID et l’id de la slide (`?ref=…&slide=…`). Une annulation de la feuille native n’envoie rien.
 */
function useShareRetro(p: PageProps, lens: Lens) {
  const toast = useToast()
  return async (slide: string) => {
    const url = `${window.location.origin}/?ref=${p.profile.visitorId}&slide=${slide}`
    const text = `Mon année solaire avec mylight150 : ${shareText(p, lens, slide)}`
    const props = { slide, vue: lens }
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mon année solaire', text, url })
        track('partage_retro', { ...props, canal: 'natif' })
      } catch {
        // Feuille fermée sans partager : rien à compter.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      track('partage_retro', { ...props, canal: 'copie' })
      toast({ message: 'Lien copié', tone: 'success' })
    } catch {
      toast({ message: 'Copiez l’adresse depuis votre navigateur' })
    }
  }
}

/** Texte partagé, après « Mon année solaire avec mylight150 : ». */
function shareText(p: PageProps, lens: Lens, slide: string) {
  const net = `≈ ${num(round50(p.virtualBatteryNetEur))} € gagnés grâce à ma batterie virtuelle.`
  const co2 = `${num(Math.round(p.co2.avoidedKg))} kg de CO₂ évités`
  switch (slide) {
    case 'intro':
      return '1 an d’énergie solaire, en vrais chiffres.'
    case 'hausse':
      return 'les prix montent le 1er novembre, et je peux compenser la hausse gratuitement.'
    case 'valeur_nette':
      return net
    case 'meilleur_jour':
      return `ma meilleure journée, ${num(p.recordSavingsDay.savings, 2)} € économisés le ${day(p.recordSavingsDay.date)}.`
    case 'co2':
      return `${co2}.`
    case 'autoconsommation':
      return `${Math.round(p.selfConsumptionRate)} % de ma production consommée chez moi.`
    case 'record':
      return `record de production le ${day(p.recordDay.date)}, ${num(p.recordDay.production, 1)} kWh.`
    case 'jours_sans_reseau':
      return `${p.zeroGridDays} jours sans réseau.`
    case 'trophees':
      return 'mes trophées de l’année.'
    default:
      return lens === 'euros' ? net : `${co2} et ${p.zeroGridDays} jours sans réseau.`
  }
}

/** Lecture « portefeuille » : le gain net comparé à la revente, puis la meilleure journée. */
function eurosSlides(p: PageProps): StorySlide[] {
  const net = round50(p.virtualBatteryNetEur)
  const resale = round50(p.surplusResaleEur)
  return [
    {
      id: 'valeur_nette',
      dark: true,
      node: (
        <RetroCard id="valeur_nette" className="bg-win text-primary-contrast" shape="bg-reward/70">
          <motion.p variants={pop} className={hero}>
            ≈ <AnimatedNumber value={net} suffix=" €" />
          </motion.p>
          <p className="text-2xl font-semibold">
            <Words text="gagnés net grâce à votre batterie virtuelle" delay={0.2} />
          </p>
          <motion.p variants={fadeUp} className="text-sm text-primary-contrast/80">
            Abonnement et contribution déduits.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-2 flex flex-col gap-3">
            <CompareBar label="Si vous aviez revendu votre surplus" value={resale} max={net} />
            <CompareBar label="Avec votre batterie virtuelle" value={net} max={net} strong />
            <p className="text-lg font-semibold">
              Environ {num(round50(p.virtualBatteryNetEur - p.surplusResaleEur))} € de plus qu’en
              revendant.
            </p>
          </motion.div>
        </RetroCard>
      ),
    },
    {
      id: 'meilleur_jour',
      node: (
        <RetroCard id="meilleur_jour" className="bg-win-surface" shape="bg-reward/30">
          <motion.p variants={fadeUp} className={`${eyebrow} text-win`}>
            <Coins className="size-4" aria-hidden /> Votre meilleure journée
          </motion.p>
          <motion.p variants={pop} className={hero}>
            <AnimatedNumber value={p.recordSavingsDay.savings} decimals={2} suffix=" €" />
          </motion.p>
          <p className="text-2xl font-semibold">
            <Words text={`économisés le ${day(p.recordSavingsDay.date)}`} delay={0.2} />
          </p>
          <motion.p variants={fadeUp} className="text-sm text-ink-muted">
            Avant abonnement et frais.
          </motion.p>
        </RetroCard>
      ),
    },
  ]
}

/** Lecture « planète » : le CO₂ en équivalents concrets, la part de soleil, le record de production. */
function impactSlides(p: PageProps): StorySlide[] {
  const trees = Math.round(p.co2.trees)
  return [
    {
      id: 'co2',
      dark: true,
      node: (
        <RetroCard id="co2" className="bg-win text-primary-contrast" shape="bg-reward/70">
          <motion.p variants={pop} className={hero}>
            <AnimatedNumber value={Math.round(p.co2.avoidedKg)} suffix=" kg" />
          </motion.p>
          <p className="text-2xl font-semibold">
            <Words text="de CO₂ évités grâce à votre soleil" delay={0.2} />
          </p>
          <motion.div variants={fadeUp} className="flex flex-col gap-2">
            <p>
              Autant que <span className="font-semibold">{trees} arbres</span> en absorbent en un an
            </p>
            <motion.ul aria-hidden className="flex flex-wrap gap-1" variants={stagger(0.05)}>
              {Array.from({ length: trees }, (_, i) => (
                <motion.li
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 6, scale: 0.6 },
                    show: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { type: 'spring', stiffness: 420, damping: 18 },
                    },
                  }}
                >
                  <TreeDeciduous className="size-6" />
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
          <motion.div variants={fadeUp} className="flex flex-col gap-2">
            <p>
              Ou{' '}
              <span className="font-semibold">≈ {num(Math.round(p.co2.carKm / 50) * 50)} km</span>{' '}
              en voiture thermique, non roulés
            </p>
            <div aria-hidden className="relative h-8 rounded-full bg-surface/15">
              <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-primary-contrast/40" />
              <motion.span
                className="absolute top-1/2 -translate-y-1/2"
                variants={{
                  hidden: { left: '0.5rem' },
                  show: {
                    left: 'calc(100% - 2rem)',
                    transition: { duration: 1.4, ease: ease.inOut, delay: 0.5 },
                  },
                }}
              >
                <Car className="size-6" />
              </motion.span>
            </div>
          </motion.div>
          <motion.p variants={fadeUp} className="text-xs text-primary-contrast/80">
            Équivalences indicatives, calculées sur votre année réelle.
          </motion.p>
        </RetroCard>
      ),
    },
    {
      id: 'autoconsommation',
      node: (
        <RetroCard id="autoconsommation" className="bg-surface-2" shape="bg-sun/40">
          <motion.p variants={fadeUp} className={`${eyebrow} text-solar`}>
            <House className="size-4" aria-hidden /> Votre maison solaire
          </motion.p>
          <p className="text-2xl font-semibold">
            <Words text="Votre soleil, vraiment chez vous" delay={0.1} />
          </p>
          <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4">
            <RateRing
              value={p.selfConsumptionRate}
              color="var(--color-solar)"
              caption="de votre production utilisée chez vous"
            />
            <RateRing
              value={p.autonomyRate}
              color="var(--color-win)"
              caption="de vos besoins couverts par votre soleil"
            />
          </motion.div>
        </RetroCard>
      ),
    },
    {
      id: 'record',
      node: (
        <RetroCard id="record" className="bg-sun" shape="bg-surface/50">
          <motion.p variants={pop} className={hero}>
            <AnimatedNumber value={p.recordDay.production} decimals={1} suffix=" kWh" />
          </motion.p>
          <p className="text-2xl font-semibold">
            <Words text={`produits le ${day(p.recordDay.date)}, votre record`} delay={0.2} />
          </p>
          <motion.p variants={fadeUp} className="text-sm">
            Sur {num(Math.round(p.productionKwh))} kWh produits dans l’année.
          </motion.p>
        </RetroCard>
      ),
    },
  ]
}

function RateRing({ value, color, caption }: { value: number; color: string; caption: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <GoalRing value={value} size={136} stroke={12} color={color} celebrate={false}>
        <span className="text-3xl font-semibold tabular-nums">
          <AnimatedNumber value={Math.round(value)} suffix=" %" />
        </span>
      </GoalRing>
      <p className="text-sm text-ink-muted">{caption}</p>
    </div>
  )
}

/** Barre de comparaison sur fond « gagnant » : la revente en pâle, la batterie virtuelle en plein. */
function CompareBar({
  label,
  value,
  max,
  strong = false,
}: {
  label: string
  value: number
  max: number
  strong?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex justify-between gap-3">
        <span className="text-primary-contrast/85">{label}</span>
        <span className="font-semibold tabular-nums">≈ {num(value)} €</span>
      </div>
      <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-surface/15">
        <motion.div
          className={cx('h-full origin-left rounded-full', strong ? 'bg-surface' : 'bg-surface/45')}
          variants={{
            hidden: { scaleX: 0 },
            show: {
              scaleX: Math.max(0.03, value / max),
              transition: { duration: duration.story, ease: ease.out, delay: 0.2 },
            },
          }}
        />
      </div>
    </div>
  )
}

/**
 * Trophées adossés aux vrais chiffres de l’année ; l’ordre suit la lecture choisie.
 * Le seul trophée verrouillé mène à l’année 2 : compenser la hausse.
 */
function buildTrophies(p: PageProps, lens: Lens): Trophy[] {
  const all: Record<string, Trophy> = {
    batterie: {
      id: 'batterie',
      icon: <PiggyBank className="size-6" />,
      title: 'Batterie gagnante',
      value: `≈ ${num(round50(p.virtualBatteryNetEur))} € net`,
      unlocked: true,
    },
    meilleur_jour: {
      id: 'meilleur_jour',
      icon: <Coins className="size-6" />,
      title: 'Meilleure journée',
      value: `${num(p.recordSavingsDay.savings, 2)} € le ${day(p.recordSavingsDay.date)}`,
      unlocked: true,
    },
    serie: {
      id: 'serie',
      icon: <Sun className="size-6" />,
      title: 'Série solaire',
      value: `${p.longestStreak.length} jours d’affilée`,
      unlocked: true,
    },
    record: {
      id: 'record',
      icon: <Zap className="size-6" />,
      title: 'Jour record',
      value: `${num(p.recordDay.production, 1)} kWh le ${day(p.recordDay.date)}`,
      unlocked: true,
    },
    maison: {
      id: 'maison',
      icon: <House className="size-6" />,
      title: 'Maison solaire',
      value: `${Math.round(p.selfConsumptionRate)} % gardés`,
      unlocked: true,
    },
    foret: {
      id: 'foret',
      icon: <Trees className="size-6" />,
      title: 'Petite forêt',
      value: `${Math.round(p.co2.trees)} arbres de CO₂`,
      unlocked: true,
    },
  }
  const order =
    lens === 'euros'
      ? ['batterie', 'meilleur_jour', 'serie', 'record', 'maison', 'foret']
      : ['foret', 'serie', 'maison', 'record', 'batterie', 'meilleur_jour']
  return [
    ...order.map((id) => all[id]),
    {
      id: 'hausse_compensee',
      icon: <ShieldCheck className="size-6" />,
      title: 'Hausse compensée',
      value: `0 € compensé sur ${Math.round(p.priceHikeEur)} €`,
      unlocked: false,
      progress: 0,
      cta: (
        <Link
          route="next_year.render"
          className="mt-1 inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
        >
          Le débloquer dans mon année 2
        </Link>
      ),
    },
  ]
}
