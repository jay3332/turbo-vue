import {A, useLocation, useNavigate, useParams} from "@solidjs/router";
import {createMemo, createSignal, For, JSX, Match, onCleanup, onMount, ParentProps, Show, Switch} from "solid-js";
import Icon, {IconElement} from "./icons/Icon";
import {getApi} from "../api/Api";
import ArrowsRotate from "./icons/svg/ArrowsRotate";
import tooltip from "../directives/tooltip";
import SolidSquare from "./icons/svg/SolidSquare";
import {someIterator} from "../utils";
import RotateLeft from "./icons/svg/RotateLeft";
import ChevronUp from "./icons/svg/ChevronUp";
import Check from "./icons/svg/Check";
void tooltip

function ActionIcon(props: { icon: IconElement }) {
  return (
    <Icon icon={props.icon} class="w-5 h-5 fill-fg/80 group-disabled:animate-spin" />
  )
}

type ActionButtonProps = { label?: string } & JSX.ButtonHTMLAttributes<HTMLButtonElement>
function ActionButton(props: ParentProps<ActionButtonProps>) {
  const omitted = createMemo(() => {
    const {
      onClick,
      label,
      'class': _, classList,
      ...actual
    } = props
    return actual
  })
  return (
    <button
      classList={{
        [
          "flex items-center justify-center h-14 rounded-xl bg-bg-0/80 hover:bg-3 transition " +
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:select-none group"
        ]: true,
        [props['class'] ?? '']: true,
        ...(props.classList ?? {})
      }}
      onClick={props.onClick}
      use:tooltip={props.label && { content: props.label, placement: 'bottom' }}
      {...omitted()}
    >
      {props.children}
    </button>
  )
}

function CourseActions() {
  const api = getApi()!
  const params = useParams()
  const navigate = useNavigate()

  const [isRefreshing, setIsRefreshing] = createSignal(false)
  const [showGradingPeriodMenu, setShowGradingPeriodMenu] = createSignal(false)
  const needsRollback = createMemo(() => {
    return params.courseId
      ? api.modifiedCourses.get(`${params.gradingPeriod}:${params.courseId}`)?.needsRollback
      : someIterator(api.modifiedCourses.values(), c => c.needsRollback)
  })
  const gradingPeriod = () => params.gradingPeriod ?? api.defaultGradingPeriod

  return (
    <>
      <Show when={params.courseId}>
        <ActionButton onClick={() => navigate('/grades/' + gradingPeriod())} label="Courses" class="w-14">
          <ActionIcon icon={SolidSquare} />
        </ActionButton>
      </Show>
      <div classList={{ "relative": true, "mobile:flex-grow": params.courseId != null }}>
        <ActionButton
          onClick={() => setShowGradingPeriodMenu(prev => !prev)}
          class="!justify-between w-full px-4"
        >
          <span class="font-title font-bold select-none">
            {api.gradingPeriods[gradingPeriod()].Name}
          </span>
          <Icon
            icon={ChevronUp}
            style={{ transform: showGradingPeriodMenu() ? "rotate(0deg)" : "rotate(180deg)" }}
            class="transition-all w-4 ml-2 fill-fg transform"
          />
        </ActionButton>
        <div onClick={() => setShowGradingPeriodMenu(r => !r)} classList={{
          "flex": showGradingPeriodMenu(),
          "hidden": !showGradingPeriodMenu(),
          ["absolute z-[999] w-48 overflow-auto max-h-1/2 right-0 mt-2 rounded-lg bg-0 border-[1px] " +
            "border-fg/20 p-2 flex-col dropdown"]: true,
          "mobile:w-full": params.courseId != null,
        }}>
          <For each={Object.values(api.gradingPeriods)}>
            {(period) => (
              <A
                href={`/grades/${period.GU}` + (params.courseId ? `/${params.courseId}` : '')}
                class="p-2 rounded-lg hover:bg-fg/10 transition flex items-center justify-between"
              >
                <span>{period.Name}</span>
                <Show when={gradingPeriod() == period.GU}>
                  <Icon icon={Check} class="w-4 h-4 fill-fg" />
                </Show>
              </A>
            )}
          </For>
        </div>
      </div>
      <ActionButton
        onClick={async () => {
          setIsRefreshing(true)
          try {
            if (params.courseId) {
              const key = `${params.gradingPeriod}:${params.courseId}`
              if (needsRollback())
                return api.populateModifiedCourse(params.gradingPeriod, api.courses.get(key)!)

              const {data} = await api.request(`/grades/${params.gradingPeriod}/courses/${params.courseId}`) // TODO: toast
              if (data) {
                api.courses.set(key, data)
                api.populateModifiedCourse(params.gradingPeriod, data)
              }
            } else if (needsRollback()) {
              for (const course of api.courses.values())
                api.populateModifiedCourse(gradingPeriod(), course)
            } else {
              await api.updateAllCourses(gradingPeriod())
            }
          } finally {
            setIsRefreshing(false)
          }
        }}
        disabled={isRefreshing()}
        label={`${needsRollback() ? 'Reset' : 'Refresh'} ${params.courseId ? 'Course' : 'Grades'}`}
        class="w-14"
      >
        <ActionIcon icon={needsRollback() ? RotateLeft : ArrowsRotate} />
      </ActionButton>
    </>
  )
}

export default function Actions() {
  const location = useLocation()

  return (
    <Switch>
      <Match when={location.pathname === '/' || location.pathname.startsWith('/grades')}>
        <CourseActions />
      </Match>
    </Switch>
  )
}