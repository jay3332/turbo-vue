import {
  createMemo,
  createSignal,
  ErrorBoundary,
  Match,
  onMount, ParentProps,
  Signal, Switch,
} from "solid-js";
import {A, Navigate, Route, Router, useLocation, useParams} from "@solidjs/router";
import {createMediaQuery} from "@solid-primitives/media";

import {BASE_URL, getApi} from "./api/Api";
import tooltip from "./directives/tooltip";
void tooltip

import Icon, {IconElement} from "./components/icons/Icon";
import ChevronLeft from "./components/icons/svg/ChevronLeft";
import GearIcon from "./components/icons/svg/Gear";
import HomeIcon from "./components/icons/svg/Home";
import SolidSquare from "./components/icons/svg/SolidSquare";
import RightFromBracket from "./components/icons/svg/RightFromBracket";

enum Tab { Home, Settings }

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

function HomeSidebar(props: { tabSignal: Signal<Tab> }) {
  const [tab, setTab] = props.tabSignal

  return (
    <div classList={{
      "flex flex-col transition-all p-2": true,
    }}>
      <Switch>
        <Match when={tab() === Tab.Home}>
          <Nav
            href="/"
            label="Grades"
            icon={SolidSquare}
            check={(path) => path === '/' || path.startsWith('/grades')}
          />
        </Match>

        <Match when={tab() === Tab.Settings}>
          <Nav href="/" label="Home" icon={HomeIcon} check={() => false} onClick={() => void setTab(Tab.Home)} />
          <button
            class="group transition rounded-lg p-3 flex items-center justify-start gap-x-3 hover:bg-danger"
            onClick={() => {
              localStorage.removeItem('token')
              window.location.href = '/'
            }}
          >
            <Icon icon={RightFromBracket} class="w-5 h-5 transition fill-danger group-hover:fill-danger-content" />
            <span class="font-title transition text-danger group-hover:text-danger-content font-bold">
              Log Out
            </span>
          </button>
        </Match>
      </Switch>
    </div>
  )
}

export function Sidebar({ signal }: { signal: Signal<Tab> }) {
  const api = getApi()!
  const [tab, setTab] = signal

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
          <HomeSidebar tabSignal={signal} />
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
          onClick={() => setTab(prev => prev === Tab.Settings ? Tab.Home : Tab.Settings)}
          class="bg-1 hover:bg-3 transition rounded-full w-10 h-10 flex items-center justify-center"
          use:tooltip={tab() === Tab.Settings ? "Home" : "Settings"}
        >
          <Icon icon={tab() === Tab.Settings ? HomeIcon : GearIcon} class="w-4 h-4 fill-fg/80" />
        </button>
      </div>
    </div>
  )
}

export const [showSidebar, setShowSidebar] = createSignal(true)

export default function Layout(props: ParentProps) {
  const api = getApi()!
  const isMobile = createMediaQuery("(max-width: 768px)")

  onMount(() => {
    if (isMobile()) setShowSidebar(false)
  })

  const sidebarSignal = createSignal(Tab.Home)
  const [swipeStart, setSwipeStart] = createSignal(0)

  const location = useLocation()
  const params = useParams()
  const header = createMemo(() => {
    let pathname = location.pathname
    if (pathname === '/') return 'Grades'
    if (pathname.startsWith('/grades')) {
      if (params.courseId) {
        const { gradingPeriod, courseId } = params
        return api.courseOrders
          .get(gradingPeriod)
          ?.find(c => c.ID.toString() === courseId)
          ?.Name
      }
      if (params.gradingPeriod) {
        return 'Grades: ' + api.gradingPeriods[params.gradingPeriod].Name
      }
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
          "opacity-100 w-72 ml-2": showSidebar(),
        }}
      >
        <div class="w-72 h-full">
          <Sidebar signal={sidebarSignal} />
        </div>
      </div>
      <div classList={{
        "flex flex-col md:flex-grow mobile:w-[100vw] h-full opacity-100 transition-opacity": true,
        "mobile:opacity-50 md:w-[calc(100%-20rem)]": showSidebar(),
      }}>
        <div class="flex flex-grow w-full gap-x-2 pt-2 px-2">
          <div class="flex flex-grow items-center bg-bg-0/80 backdrop-blur h-14 rounded-xl">
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
        </div>
        <div
          class="flex flex-col flex-grow w-full h-full overflow-auto"
          onClick={() => isMobile() && setShowSidebar(false)}
        >
          <ErrorBoundary fallback={(err) => (
            <div class="text-red-900 bg-red-300 rounded-lg p-4 mr-2 mt-2 flex flex-col">
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
