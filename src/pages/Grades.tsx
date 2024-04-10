import {getApi} from "../api/Api";
import {createEffect, createMemo, For, Show} from "solid-js";
import {CourseMetadata} from "../api/types";
import Icon from "../components/icons/Icon";
import LocationDot from "../components/icons/svg/LocationDot";
import {A, useParams} from "@solidjs/router";
import Loading from "../components/Loading";
import {isMCPS} from "../utils";

function sanitizeGradePreview(preview: string): number {
  if (preview.endsWith('%')) preview = preview.slice(0, -1)
  return parseFloat(preview)
}

export function CourseGrade({ gradingPeriod, course }: { gradingPeriod: string, course: CourseMetadata }) {
  const api = getApi()!

  const resolved = createMemo(() => api.courses.get(`${gradingPeriod}:${course.ID}`))
  const ratio = createMemo(() => {
    if (!resolved()) return sanitizeGradePreview(course.scorePreview) / 100
    else if (!api.modifiedCourses.has(`${gradingPeriod}:${course.ID}`))
      return resolved()!.classGrades[0].totalWeightedPercentage / 100

    return api.calculateWeightedPointRatio(gradingPeriod, course.ID)
  });
  const scoreStyle = createMemo(() => resolved()
    ? api.calculateScoreStyle(resolved()!.classGrades[0].reportCardScoreTypeId, ratio())
    : api.calculateScoreStyle(api.policy.defaultReportCardScoreTypeId, ratio())
  )
  const mark = createMemo(() => {
    if (!resolved()) return course.markPreview
    const grade = resolved()!.classGrades[0]
    if (!api.modifiedCourses.has(`${gradingPeriod}:${course.ID}`))
      return grade.manualMark ?? grade.calculatedMark

    return api.calculateMark(grade.reportCardScoreTypeId, ratio())
  })
  const style = () => ({ color: `rgb(var(--c-${scoreStyle()}))` })
  const fmt = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 })

  return (
    <div class="flex flex-col items-center w-12">
      <span class="font-title text-xl" style={style()}>{mark()}</span>
      <Show when={!isNaN(ratio())}>
        <span class="text-sm" style={style()}>{fmt.format(ratio())}</span>
      </Show>
    </div>
  )
}

function GPA(props: { label: string, gpa: number }) {
  return (
    <div class="flex flex-col items-center">
      <span class="font-title font-bold text-sm text-fg/60">{props.label}</span>
      <h2 class="font-medium text-xl" style={{ color: `rgb(var(--c-scale-${Math.floor(props.gpa) + 1}))` }}>{
        isNaN(props.gpa)
          ? 'N/A'
          : props.gpa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }</h2>
    </div>
  )
}

export function GradesInner(props: { gradingPeriod: string }) {
  const api = getApi()!
  const gpas = createMemo(() => api.calculateMcpsGpa(props.gradingPeriod))

  return (
    <div class="flex flex-col h-full justify-between">
      <div class="flex flex-col p-2">
        <div class="flex gap-2 flex-wrap">
          <For each={api.courseOrders.get(props.gradingPeriod)}>
            {(course: CourseMetadata) => (
              <A
                href={`/grades/${props.gradingPeriod}/${course.ID}`}
                class="flex justify-between items-center p-4 rounded-xl w-full lg:w-[calc(50%-0.25rem)] bg-bg-0/50
                  transition hover:bg-bg-3/80"
              >
                <div class="flex flex-col">
                  <span class="font-title font-medium md:text-lg">{course.Name}</span>
                  <span class="flex items-center gap-x-3 mobile-xs:flex-col mobile-xs:items-start">
                    <span class="text-sm text-fg/50 text-left">{course.TeacherName}</span>
                    <span class="flex items-center gap-x-1 text-left">
                      <Icon icon={LocationDot} class="w-4 h-4 fill-fg/50" />
                      <span class="text-sm text-fg/50">{course.room}</span>
                    </span>
                  </span>
                </div>
                <CourseGrade gradingPeriod={props.gradingPeriod} course={course} />
              </A>
            )}
          </For>
        </div>
      </div>
      {isMCPS() && (
        <div class="px-2 pb-2">
          <div class="bg-0 p-4 rounded-xl flex justify-center gap-x-[50%] flex-wrap">
            <GPA label="GPA" gpa={gpas().unweighted} />
            <GPA label="WGPA" gpa={gpas().weighted} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function Grades() {
  const api = getApi()!
  const params = useParams()
  const gradingPeriod = createMemo(() => params.gradingPeriod ?? api.defaultGradingPeriod)

  createEffect(async () => {
    if (!api.courseOrders.has(gradingPeriod())) {
      const { data } = await api.request(`/grades/${gradingPeriod()}/courses?include_course_order=1`)
      if (data) {
        const { courseOrder, courses } = data
        api.courseOrders.set(gradingPeriod(), courseOrder)
        api.populateAllCourses(gradingPeriod(), courses)
      }
    }
  })

  return (
    <Show when={api.courseOrders.has(gradingPeriod())} fallback={<Loading />}>
      <GradesInner gradingPeriod={gradingPeriod()} />
    </Show>
  )
}