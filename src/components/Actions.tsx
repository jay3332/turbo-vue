import {useLocation, useParams} from "@solidjs/router";
import {JSX, Match, Switch} from "solid-js";
import Icon, {IconElement} from "./icons/Icon";
import {getApi} from "../api/Api";
import ArrowsRotate from "./icons/svg/ArrowsRotate";
import tooltip from "../directives/tooltip";
void tooltip

type ActionButtonProps = { icon: IconElement, label: string } & JSX.ButtonHTMLAttributes<HTMLButtonElement>
function ActionButton({ onClick, icon, label, ...props }: ActionButtonProps) {
  return (
    <button
      class="flex items-center justify-center w-14 h-full rounded-xl bg-bg-0/80 hover:bg-3 transition
        disabled:opacity-50 disabled:cursor-not-allowed disabled:select-none group"
      onClick={onClick}
      use:tooltip={{ content: label, placement: 'bottom' }}
      {...props}
    >
      <Icon icon={icon} class="w-5 h-5 fill-fg/80 group-disabled:animate-spin" />
    </button>
  )
}


function CourseActions() {
  const api = getApi()!
  const params = useParams()

  return (
   <ActionButton
      onClick={async (event) => {
        const target = event.currentTarget
        target.disabled = true
        try {
          if (params.courseId) {
            const {data} = await api.request(`/grades/${params.gradingPeriod}/courses/${params.courseId}`) // TODO: toast
            if (data) {
              const key = `${params.gradingPeriod}:${params.courseId}`
              api.courses.set(key, data)
              api.populateAssignments(params.gradingPeriod, data)
            }
          } else {
            await api.updateAllCourses(params.gradingPeriod)
          }
        } finally {
          target.disabled = false
        }
      }}
      icon={ArrowsRotate}
      label={params.courseId ? 'Refresh Course' : 'Refresh Grades'}
    />
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