import {createEffect, createMemo, ParentProps, Show} from "solid-js";
import {A, useLocation, useNavigate, useParams} from "@solidjs/router";
import Icon, {IconElement} from "../components/icons/Icon";
import TableList from "../components/icons/svg/TableList";
import ChartLine from "../components/icons/svg/ChartLine";
import BullseyeArrow from "../components/icons/svg/BullseyeArrow";
import {getApi, Gradebook} from "../api/Api";
import Loading from "../components/Loading";

function Skeleton() {
  const Tab = () => (
    <div
      class="bg-bg-0/80 hover:bg-bg-3/80 rounded p-4 mobile:p-3 flex flex-grow items-center transition justify-center gap-x-2 box-border">
      <div class="w-4 h-4 bg-fg/20 rounded-full animate-pulse"/>
      <div class="mobile-xs:hidden">
        <div class="w-12 h-4 bg-fg/20 rounded-full animate-pulse"/>
      </div>
    </div>
  )

  return (
    <div class="flex flex-col flex-grow">
      <div class="flex flex-col mx-2 mt-2 overflow-hidden rounded-xl">
        <div class="flex justify-between p-4 bg-bg-0/80 rounded">
          <div class="flex flex-col">
            <div class="w-40 h-6 bg-fg/20 rounded-full animate-pulse"/>
            <div class="w-20 h-4 bg-fg/20 rounded-full animate-pulse mt-1" />
          </div>
          <div class="flex flex-col items-center justify-center">
            <div class="w-12 h-12 bg-fg/20 rounded-xl animate-pulse" />
            <div class="w-12 h-4 bg-fg/20 rounded-full animate-pulse mt-1" />
          </div>
        </div>
        <div class="flex gap-x-1 mt-1">
          <Tab />
          <Tab />
          <Tab />
        </div>
      </div>
    </div>
  )
}

export default function CourseLayout(props: ParentProps) {
  const api = getApi()!
  const params = useParams()
  const navigate = useNavigate()

  const gradingPeriod = () => params.gradingPeriod ?? api.gradebook?.defaultGradingPeriod
  const key = () => `${gradingPeriod()}:${params.courseId}`

  createEffect(async () => {
    if (!api.gradebook) {
      const { data } = await api.request('/grades')
      if (data) {
        api.gradebook = Gradebook.fromResponse(api, data)
      } else {
        navigate('/')
      }
    }
    let gb = api.gradebook!
    if (!gb.courseOrders.has(gradingPeriod())) {
      const { data } = await api.request(`/grades/${gradingPeriod()}`)
      if (data) {
        gb.courseOrders.set(gradingPeriod(), data)
      } else {
        navigate('/')
      }
    }
    if (!gb.courses.has(key())) {
      const { data } = await api.request(`/grades/${gradingPeriod()}/courses/${params.courseId}`)
      if (data) {
        gb.courses.set(key(), data)
        gb.populateModifiedCourse(gradingPeriod(), data)
      } else {
        navigate(`/grades/${gradingPeriod()}`)
      }
    }
  })

  return (
    <Show
      when={api.gradebook && api.gradebook.courses.has(key()) && api.gradebook.modifiedCourses.has(key())}
      fallback={<Skeleton />}
    >
      <CourseLayoutInner {...props} gradebook={api.gradebook!} />
    </Show>
  )
}

export function CourseLayoutInner(props: ParentProps<{ gradebook: Gradebook }>) {
  const params = useParams()
  const gradebook = props.gradebook
  const key = () => `${params.gradingPeriod}:${params.courseId}`

  const course = createMemo(() => gradebook.courses.get(key()))
  const metadata = createMemo(() => (
    gradebook.courseOrders.get(params.gradingPeriod)!.find(course => course.ID.toString() == params.courseId)!
  ))

  const scoreType = createMemo(() => course()!.classGrades[0].reportCardScoreTypeId)
  const ratio = createMemo(() => gradebook.calculateWeightedPointRatio(params.gradingPeriod, parseInt(params.courseId)))
  const style = createMemo(() => ({color: `rgb(var(--c-${gradebook.calculateScoreStyle(scoreType()!, ratio()!)}))`}))
  const mark = createMemo(() => gradebook.calculateMark(scoreType()!, ratio()!))

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
            <h1 class="font-title text-2xl mobile:text-xl">{metadata().Name}</h1>
            <div class="flex items-center gap-x-3">
              <span class="text-fg/60 font-light mobile:text-sm">{metadata().TeacherName}, Room {metadata().room}</span>
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
          <TabButton icon={ChartLine} label="Graph" path="analyze" />
          <TabButton icon={BullseyeArrow} label="Optimize" path="optimize" />
        </div>
      </div>
      {props.children}
    </div>
  )
}
