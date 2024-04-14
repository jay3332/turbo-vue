import {createEffect, createMemo, ParentProps, Show} from "solid-js";
import {A, useLocation, useNavigate, useParams} from "@solidjs/router";
import Icon, {IconElement} from "../components/icons/Icon";
import TableList from "../components/icons/svg/TableList";
import ChartLine from "../components/icons/svg/ChartLine";
import BullseyeArrow from "../components/icons/svg/BullseyeArrow";
import {getApi} from "../api/Api";
import Loading from "../components/Loading";

export default function CourseLayout(props: ParentProps) {
  const api = getApi()!
  const params = useParams()
  const navigate = useNavigate()

  const gradingPeriod = () => params.gradingPeriod ?? api.defaultGradingPeriod
  const key = () => `${gradingPeriod()}:${params.courseId}`

  createEffect(async () => {
    if (!api.courseOrders.has(gradingPeriod())) {
      const { data } = await api.request(`/grades/${gradingPeriod()}`)
      if (data) {
        api.courseOrders.set(gradingPeriod(), data)
      } else {
        navigate('/')
      }
    }
    if (!api.courses.has(key())) {
      const { data } = await api.request(`/grades/${gradingPeriod()}/courses/${params.courseId}`)
      if (data) {
        api.courses.set(key(), data)
        api.populateModifiedCourse(gradingPeriod(), data)
      } else {
        navigate(`/grades/${gradingPeriod()}`)
      }
    }
  })

  return (
    <Show when={api.courses.has(key()) && api.modifiedCourses.has(key())} fallback={<Loading />}>
      <CourseLayoutInner {...props} />
    </Show>
  )
}

export function CourseLayoutInner(props: ParentProps) {
  const api = getApi()!
  const params = useParams()
  const key = () => `${params.gradingPeriod}:${params.courseId}`

  const course = createMemo(() => api.courses.get(key()))
  const metadata = createMemo(() => (
    api.courseOrders.get(params.gradingPeriod)!.find(course => course.ID.toString() == params.courseId)!
  ))

  const scoreType = createMemo(() => course()!.classGrades[0].reportCardScoreTypeId)
  const ratio = createMemo(() => api.calculateWeightedPointRatio(params.gradingPeriod, parseInt(params.courseId)))
  const style = createMemo(() => ({color: `rgb(var(--c-${api.calculateScoreStyle(scoreType()!, ratio()!)}))`}))
  const mark = createMemo(() => api.calculateMark(scoreType()!, ratio()!))

  const location = useLocation()
  const TabButton = ({ icon, label, path }: { icon: IconElement, label: string, path?: string }) => {
    const href = `/grades/${params.gradingPeriod}/${params.courseId}` + (path ? `/${path}` : '')
    return (
      <A
        classList={{
          "bg-bg-0/80 hover:bg-bg-3/80 rounded p-4 mobile:p-3 flex flex-grow items-center transition justify-center gap-x-2 box-border": true,
          "border-b-2 border-accent": location.pathname == href,
        }}
        href={href}
      >
        <Icon icon={icon} class="w-4 h-4 fill-fg" />
        <span class="font-title font-bold text-sm lg:text-base mobile-xs:hidden">{label}</span>
      </A>
    )
  }

  return (
    <div class="flex flex-col flex-grow">
      <div class="flex flex-col mx-2 mt-2 overflow-hidden rounded-xl">
        <div class="flex justify-between p-4 bg-bg-0/80 rounded">
          <div class="flex flex-col">
            <h1 class="font-title text-2xl">{metadata().Name}</h1>
            <div class="flex items-center gap-x-3">
              <span class="text-fg/60">{metadata().TeacherName}, Room {metadata().room}</span>
            </div>
          </div>
          <div class="flex flex-col items-center justify-center">
            <span class="font-title text-3xl" style={style()}>{mark()}</span>
            <Show when={!isNaN(ratio())}>
              <span class="text-sm" style={style()}>
                {new Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 2}).format(ratio())}
              </span>
            </Show>
          </div>
        </div>
        <div class="flex gap-x-1 mt-1">
          <TabButton icon={TableList} label="Assignments" />
          <TabButton icon={ChartLine} label="Analyze" path="analyze" />
          <TabButton icon={BullseyeArrow} label="Optimize" path="optimize" />
        </div>
      </div>
      {props.children}
    </div>
  )
}
