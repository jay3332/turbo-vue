import {A, useParams} from "@solidjs/router";
import {createAssignment, CustomAssignment, getApi} from "../api/Api";
import {Accessor, createEffect, createMemo, createSignal, For, on, Setter, Show} from "solid-js";
import Icon from "../components/icons/Icon";
import Xmark from "../components/icons/svg/Xmark";
import Dropdown from "../components/Dropdown";
import {MeasureType} from "../api/types";
import Plus from "../components/icons/svg/Plus";

function isMCPS() {
  const host = localStorage.getItem('preferredHost')
  return !host || JSON.parse(host).host === 'https://md-mcps-psv.edupoint.com'
}

function sanitizeCategoryType(category: string) {
  if (!isMCPS()) return category
  switch (category) {
    case 'All Tasks / Assessments': return 'All Tasks'
    case 'Practice / Preparation': return 'Practice/Prep'
    default: return category
  }
}

const transform = (value: string) => parseFloat(value.replaceAll(',', '')).toString()

type AssignmentProps = { assignment: CustomAssignment, idx: Accessor<number>, setAssignments: Setter<CustomAssignment[]> }

function AssignmentDetails(props: AssignmentProps) {
  const api = getApi()!
  const {gradingPeriod, courseId} = useParams()
  const key = `${gradingPeriod}:${courseId}`

  const [name, setName] = createSignal(props.assignment.name)
  const [category, setCategory] = createSignal(props.assignment.category)
  const [score, setScore] = createSignal(props.assignment.score)
  const [maxScore, setMaxScore] = createSignal(props.assignment.maxScore)
  const [measureTypeId, setMeasureTypeId] = createSignal(props.assignment.measureTypeId)

  const ratio = createMemo(() => parseFloat(score()!) / parseFloat(maxScore()))
  const formattedPercent = createMemo(() => new Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 2}).format(ratio()))

  const dueDate = props.assignment.dueDate
  const scoreType = props.assignment.reportCardScoreTypeId
  const forGrading = props.assignment.isForGrading

  createEffect(on(
    [name, category, score, maxScore, measureTypeId],
    ([name, category, score, maxScore, measureTypeId]) => {
      const updated = {
        ...props.assignment,
        name,
        category,
        score,
        maxScore,
        measureTypeId,
      }
      const modified = api.assignments.get(key)!.map((old, j) => (
        props.idx() == j ? updated : {...old}
      ))
      api.assignments.set(key, modified)
    },
    { defer: true }
  ))

  return (
    <tr class="transition hover:bg-fg/5 [&+tr]:border-t-[1px] border-bg-3">
      <td class="text-sm px-2 py-3 break-words">
        <h2>{name() ?? 'Unnamed Assignment'}</h2>
        <span class="font-light text-xs text-fg/60">{dueDate}</span>
      </td>
      <td class="text-center">
        <div class="w-full flex justify-center">
          <Dropdown options={
            <div class="bg-bg-1 w-36 break-words">
              <For each={api.policy.measureTypes}>
                {measureType => (
                  <button
                    class="block w-full text-sm px-3 py-1.5 hover:bg-fg/10 transition"
                    onClick={() => {
                      setCategory(measureType.name)
                      setMeasureTypeId(measureType.id)
                    }}
                  >
                    {measureType.name}
                  </button>
                )}
              </For>
            </div>
          }>
            {forGrading ? (
              <span class="font-light text-sm">
                {sanitizeCategoryType(category())}
              </span>
            ) : (
              <span class="font-light text-sm text-highlight">Not for Grading</span>
            )}
          </Dropdown>
        </div>
      </td>
      <td class="text-center">
        <Show when={score() != null} fallback={
          <div class="flex w-full justify-center">
            <button
              class="flex flex-col px-2 py-1 -mx-2 -my-1 items-center rounded-lg relative group hover:bg-fg/10 transition"
              onClick={() => setScore('0')}
            >
              <span class="text-sm group-hover:hidden">Not Graded</span>
              <span class="text-sm hidden group-hover:block">Add Score</span>
              <span class="text-xs font-light text-white/70">
                {parseFloat(maxScore()).toLocaleString()} Pts Possible
              </span>
            </button>
          </div>
        }>
          <h2 class="mt-1">
            <sup>
              <input
                style={{
                  color: `rgb(var(--c-${api.calculateScoreStyle(scoreType, ratio())}))`,
                  width: `${transform(score()!).length}ch`,
                }}
                class="font-bold text-base text-right focus:outline-none bg-transparent"
                type="number"
                inputMode="decimal"
                value={transform(score()!)}
                onInput={e => {
                  if (e.currentTarget.value === '') return setScore('0')
                  setScore(e.currentTarget.value as any)
                }}
              />
            </sup>
            <span class="text-fg/70 font-light text-lg">&frasl;</span>
            <sub>
              <input
                style={{width: `${transform(maxScore()!).length}ch`}}
                class="text-fg/60 font-light text-sm focus:outline-none bg-transparent"
                type="number"
                inputMode="decimal"
                value={transform(maxScore()!)}
                onInput={e => {
                  if (e.currentTarget.value === '') return setScore('1')
                  setMaxScore(e.currentTarget.value as any)
                }}
              />
            </sub>
          </h2>
        </Show>
      </td>
      <td class="text-center font-light lg:table-cell hidden">
        {score() == null ? '-' : formattedPercent()}
      </td>
      <td class="text-center">
        <button class="mt-1.5" onClick={() => {
          const modified = api.assignments.get(key)!.filter((_, j) => j != props.idx())
          api.assignments.set(key, modified)
          props.setAssignments(modified)
        }}>
          <Icon
            icon={Xmark}
            class="w-4 h-4 fill-fg/40 hover:fill-danger transition"
            tooltip="Delete Assignment"
          />
        </button>
      </td>
    </tr>
  )
}

type WPBProps = { gradingPeriod: string, courseId: number, measureType: MeasureType, scoreType: number }

function WeightProgressBar({ gradingPeriod, courseId, measureType, scoreType }: WPBProps) {
  const api = getApi()!
  const points = createMemo(() => api.totalAssignmentPoints(gradingPeriod, courseId, measureType.id))
  const maxPoints = createMemo(() => api.maxAssignmentPoints(gradingPeriod, courseId, measureType.id))
  if (!points() || !maxPoints()) return null

  const ratio = () => points() / maxPoints()
  const style = () => api.calculateScoreStyle(scoreType, ratio())

  return (
    <div class="relative flex-grow mx-2 mt-2 bg-bg-3/80 rounded-lg h-12 overflow-hidden">
      <div
        class="opacity-20 h-full"
        style={{ width: `${Math.max(0.0, Math.min(1.0, ratio())) * 100}%`, background: `rgb(var(--c-${style()}))` }}
      />
      <div class="absolute z-10 flex px-3 inset-0 w-full h-full items-center justify-between">
        <h2 class="font-title font-bold text-medium">{measureType.name}</h2>
        <div class="flex items-center">
          <div class="mt-1 mr-8 mobile-xs:mr-0">
            <sup class="font-bold text-base text-right">
              {points()}
            </sup>
            <span class="text-fg/70 font-light text-lg">&frasl;</span>
            <sub class="font-light text-fg/60">{maxPoints()}</sub>
          </div>
          <span class="w-14 text-right mobile:w-10 mobile:text-sm mobile-xs:hidden">
            {Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 2}).format(ratio())}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function CourseDetails() {
  const api = getApi()!
  const {gradingPeriod, courseId} = useParams()
  const key = `${gradingPeriod}:${courseId}`
  return (
    <Show when={api.courses.has(key) && api.assignments.has(key)} fallback={
      <div class="animate-pulse font-bold font-title text-2xl flex items-center justify-center h-full">
        Loading...
      </div>
    }>
      <CourseDetailsInner/>
    </Show>
  )
}

export function CourseDetailsInner() {
  const api = getApi()!
  const {gradingPeriod, courseId} = useParams()
  const key = `${gradingPeriod}:${courseId}`

  const course = createMemo(() => api.courses.get(key))
  const metadata = createMemo(() => (
    api.courseOrders.get(gradingPeriod)!.find(course => course.ID.toString() == courseId)!
  ))
  const [assignments, setAssignments] = createSignal<CustomAssignment[]>([])

  const scoreType = createMemo(() => course()!.classGrades[0].reportCardScoreTypeId)
  const ratio = createMemo(() => api.calculateWeightedPointRatio(gradingPeriod, parseInt(courseId)))
  const style = createMemo(() => ({color: `rgb(var(--c-${api.calculateScoreStyle(scoreType()!, ratio()!)}))`}))
  const mark = createMemo(() => api.calculateMark(scoreType()!, ratio()!))

  createEffect(() => {
    if (course() && !assignments()?.length) {
      setAssignments(api.assignments.get(key)!)
    }
  })

  createEffect(on(
    assignments, (assignments) => api.assignments.set(key, assignments),
    { defer: true }
  ))

  return (
    <>
      <div class="flex justify-between p-4 bg-bg-0/80 mx-2 mt-2 rounded-lg">
        <div class="flex flex-col">
          <h1 class="font-title text-2xl">{metadata().Name}</h1>
          <div class="flex items-center gap-x-3">
            <span class="text-fg/60">{metadata().TeacherName}, Room {metadata().room}</span>
            <Dropdown optionsClass="right-0" class="transition rounded-lg !p-0" options={
              <div class="bg-bg-1 w-36">
                <For each={Object.entries(api.gradingPeriods)}>
                  {([key, period]) => (
                    <A
                      class="block w-full text-sm px-3 py-1.5 hover:bg-fg/10 transition"
                      href={`/grades/${key}/${courseId}`}
                    >
                      {period.Name}
                    </A>
                  )}
                </For>
              </div>
            }>
              {api.gradingPeriods[gradingPeriod].Name}
            </Dropdown>
          </div>
        </div>
        <div class="flex flex-col items-center">
          <span class="font-title text-3xl" style={style()}>{mark()}</span>
          <span class="text-sm" style={style()}>
            {new Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 2}).format(ratio())}
          </span>
        </div>
      </div>
      <div class="flex flex-col">
        <For each={api.policy.measureTypes}>
          {(measureType) => (
            <WeightProgressBar
              gradingPeriod={gradingPeriod}
              courseId={parseInt(courseId)}
              measureType={measureType}
              scoreType={scoreType()}
            />
          )}
        </For>
      </div>
      <div class="flex flex-col m-2">
        <div class="overflow-hidden rounded-lg">
          <table class="w-full">
            <thead class="bg-bg-0 font-title">
              <tr class="[&>th]:py-3">
                <th scope="col" class="w-1/2">Assignment</th>
                <th scope="col" class="px-4">Category</th>
                <th scope="col" class="px-4">Score</th>
                <th class="lg:table-cell hidden">%</th>
                <th scope="col" class="px-4">
                  <button class="flex items-center justify-center w-full h-full" onClick={() => {
                    const measureType = api.policy.measureTypes[0]
                    const dummyAssignment = createAssignment({
                      category: measureType.name,
                      commentCode: null,
                      dueDate: 'Custom Assignment',
                      excused: false,
                      gradeBookCategoryId: 0,
                      gradeBookId: 0,
                      gradeBookScoreTypeId: scoreType(),
                      gradingPeriodId: 0,
                      isForGrading: true,
                      maxScore: '0',
                      maxValue: 0,
                      measureTypeId: measureType.id,
                      name: 'New Assignment',
                      reportCardScoreTypeId: scoreType(),
                      score: '0',
                      studentId: api.policy.students[0].id,
                      week: '',
                    }, true)
                    const modified = [dummyAssignment, ...assignments()]
                    setAssignments(modified)
                  }}>
                    <Icon icon={Plus} class="fill-fg w-4 h-4 hover:fill-accent transition" tooltip="Add Assignment" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={assignments()} fallback="No assignments yet!">
                {(assignment, idx) => (
                  <AssignmentDetails assignment={assignment} idx={idx} setAssignments={setAssignments} />
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}