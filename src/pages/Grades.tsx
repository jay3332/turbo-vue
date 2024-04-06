import {getApi} from "../api/Api";
import {createMemo, For} from "solid-js";
import {CourseMetadata} from "../api/types";
import Icon from "../components/icons/Icon";
import LocationDot from "../components/icons/svg/LocationDot";
import {A, useParams} from "@solidjs/router";

function sanitizeGradePreview(preview: string): number {
  if (preview.endsWith('%')) preview = preview.slice(0, -1)
  return parseFloat(preview)
}

export function CourseGrade({ gradingPeriod, course }: { gradingPeriod: string, course: CourseMetadata }) {
  const api = getApi()!

  const resolved = createMemo(() => api.courses.get(`${gradingPeriod}:${course.ID}`))
  const ratio = createMemo(() => {
    if (!resolved()) return sanitizeGradePreview(course.scorePreview) / 100
    return resolved()!.classGrades[0].totalWeightedPercentage / 100 // TODO: should return percent after CALCULATIONS
  });
  const scoreStyle = createMemo(() => resolved()
    ? api.calculateScoreStyle(resolved()!.classGrades[0].reportCardScoreTypeId, ratio())
    : api.calculateScoreStyle(api.policy.defaultReportCardScoreTypeId, ratio())
  )
  const mark = createMemo(() => {
    if (!resolved()) return course.markPreview
    const grade = resolved()!.classGrades[0]
    return grade.manualMark ?? grade.calculatedMark  // TODO: should return percent after CALCULATIONS
  })
  const style = () => ({ color: `rgb(var(--c-${scoreStyle()}))` })
  const fmt = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 })

  return (
    <div class="flex flex-col items-center w-12">
      <span class="font-title text-xl" style={style()}>{mark()}</span>
      <span class="text-sm" style={style()}>{fmt.format(ratio())}</span>
    </div>
  )
}

export default function Grades() {
  const api = getApi()!
  let { gradingPeriod } = useParams()
  gradingPeriod ??= api.defaultGradingPeriod

  return (
    <div class="flex flex-col p-2">
      <div class="flex gap-2 flex-wrap">
        <For each={api.courseOrders.get(gradingPeriod)}>
          {(course: CourseMetadata) => (
            <A
              href={`/grades/${gradingPeriod}/${course.ID}`}
              class="flex justify-between items-center p-4 rounded-lg w-full lg:w-[calc(50%-0.25rem)] bg-bg-0/50
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
              <CourseGrade gradingPeriod={gradingPeriod} course={course} />
            </A>
          )}
        </For>
      </div>
    </div>
  )
}