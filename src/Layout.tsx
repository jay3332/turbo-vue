import {
  createMemo,
  createSignal,
  ErrorBoundary,
  onMount, ParentProps,
  Switch,
} from "solid-js";
import {A, useLocation, useParams} from "@solidjs/router";
import {createMediaQuery} from "@solid-primitives/media";

import {BASE_URL, getApi} from "./api/Api";
import tooltip from "./directives/tooltip";
void tooltip

import Icon, {IconElement} from "./components/icons/Icon";
import ChevronLeft from "./components/icons/svg/ChevronLeft";
import SolidSquare from "./components/icons/svg/SolidSquare";
import RightFromBracket from "./components/icons/svg/RightFromBracket";
import Actions from "./components/Actions";
import CircleInfo from "./components/icons/svg/CircleInfo";
import Bug from "./components/icons/svg/Bug";

function Nav(props: {
  href: string,
  label: string,
  icon: IconElement,
  check?: (path: string) => boolean,
  onClick?: () => void,
}) {
  let active = createMemo(() => {
    return props.check ? props.check(useLocation().pathname) : useLocation().pathname === props.href
  })
  return (
    <A href={props.href} onClick={props.onClick} classList={{
      "group transition rounded-lg p-3 flex items-center justify-start gap-x-3": true,
      "bg-fg/10": active(),
      "hover:bg-fg/20": !active(),
    }}>
      <Icon icon={props.icon} class="w-5 h-5 fill-fg/80" />
      <span classList={{
        "font-title transition font-bold": true,
        "text-fg/100": active(),
        "text-fg/70 group-hover:text-fg/90": !active(),
      }}>
        {props.label}
      </span>
    </A>
  )
}

function HomeSidebar() {
  const params = useParams()

  return (
    <div class="flex flex-col p-2">
      <Nav
        href={params.gradingPeriod ? '/grades/' + params.gradingPeriod : '/'}
        label="Grades"
        icon={SolidSquare}
        check={(path) => path === '/' || path.startsWith('/grades')}
      />
      <div class="divider mx-2" />
      <Nav href="/about" label="About" icon={CircleInfo} />
      <Nav href="//github.com/jay3332/turbo-vue/issues/new/choose" label="Report a Bug" icon={Bug} />
    </div>
  )
}

export function Sidebar() {
  const api = getApi()!

  let photoRef: HTMLImageElement | null = null

  onMount(() => {
    const options = {
      headers: { Authorization: api.token }
    }
    fetch(BASE_URL + '/photo', options).then(r => r.blob()).then((blob) => {
      photoRef!.src = URL.createObjectURL(blob)
    })
  })

  return (
    <div class="flex flex-col w-full h-full justify-between backdrop-blur transition bg-bg-0/80">
      <div class="flex flex-grow h-[calc(100%-56px)]">
        <div class="flex flex-col w-full overflow-y-auto hide-scrollbar transition duration-500">
          <HomeSidebar />
        </div>
      </div>
      <div class="bg-bg-0 p-2 flex justify-between">
        <div class="flex gap-2">
          <div class="indicator">
            <img ref={photoRef!} alt="" class="w-10 h-10 rounded-xl object-cover" />
          </div>
          <div class="flex flex-col justify-center">
            <h3 class="text-fg/80 font-title font-bold">{api.student.name}</h3>
            <span class="text-fg/50 text-xs">{api.student.schoolName}</span>
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('token')
            window.location.href = '/'
          }}
          class="bg-2 hover:bg-danger group transition rounded-full w-10 h-10 flex items-center justify-center"
          use:tooltip="Log Out"
        >
          <Icon icon={RightFromBracket} class="w-4 h-4 fill-fg" />
        </button>
      </div>
    </div>
  )
}

export const [showSidebar, setShowSidebar] = createSignal(true)

export default function Layout(props: ParentProps) {
  const isMobile = createMediaQuery("(max-width: 768px)")

  onMount(() => {
    if (isMobile()) setShowSidebar(false)
  })

  const [swipeStart, setSwipeStart] = createSignal(0)

  const location = useLocation()
  const params = useParams()
  const header = createMemo(() => {
    let pathname = location.pathname
    if (pathname === '/') return 'Grades'
    if (pathname === '/about') return 'About'
    if (pathname.startsWith('/grades')) {
      if (params.courseId) return 'Course Details'
      return 'Grades'
    }
  })

  return (
    <div
      class="w-full mobile:w-[calc(100%+20rem)] h-full flex overflow-hidden"
      onTouchStart={(event) => setSwipeStart(event.touches[0].clientX)}
      onTouchEnd={(event) => {
        if (!isMobile()) return

        const swipeEnd = event.changedTouches[0].clientX
        const swipeDiff = swipeEnd - swipeStart()
        if (swipeDiff < -100) setShowSidebar(false)
        if (swipeDiff > 100) setShowSidebar(true)
      }}
    >
      <div
        classList={{
          "my-2 rounded-2xl transition-all duration-300 overflow-hidden": true,
          "opacity-0 w-0 ml-0": !showSidebar(),
          "opacity-100 w-64 ml-2": showSidebar(),
        }}
      >
        <div class="w-64 h-full">
          <Sidebar />
        </div>
      </div>
      <div classList={{
        "flex flex-col md:flex-grow mobile:w-[100vw] h-full opacity-100 transition-opacity": true,
        "mobile:opacity-50 md:w-[calc(100%-20rem)]": showSidebar(),
      }}>
        <div class="flex flex-grow w-full gap-x-2 pt-2 px-2">
          <div classList={{
            "flex flex-grow items-center bg-bg-0/80 backdrop-blur h-14 rounded-xl": true,
            "mobile:hidden": params.courseId != null,
          }}>
            <button
              use:tooltip={showSidebar() ? "Collapse Sidebar" : "Show Sidebar"}
              class="inline-flex py-2 mx-4 transition-transform duration-200 group"
              style={{"transform": showSidebar() ? "rotate(0deg)" : "rotate(180deg)"}}
              onClick={() => setShowSidebar(prev => !prev)}
            >
              <Icon
                icon={ChevronLeft}
                class="w-4 h-4 fill-fg/50 group-hover:fill-fg/80 transition duration-200"
              />
            </button>
            <span class="font-title font-bold">{header()}</span>
          </div>
          <Actions />
        </div>
        <div
          class="flex flex-col flex-grow w-full h-full overflow-auto"
          onClick={() => isMobile() && setShowSidebar(false)}
        >
          <ErrorBoundary fallback={(err) => (
            <div class="text-red-900 bg-red-300 rounded-lg p-4 mx-2 mt-2 flex flex-col">
              <p class="font-bold">Error: {err.message}</p>
              <p class="font-light text-sm">
                If this error persists, please&nbsp;
                <a class="underline underline-offset-2" href="https://github.com/jay3332/turbo-vue/issues/new/choose">
                  open an issue
                </a>
                &nbsp;in the GitHub repository.
              </p>
              <pre class="whitespace-pre-wrap break-words mt-2">{err.stack}</pre>
            </div>
          )}>
            {props.children}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
