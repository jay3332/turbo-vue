import {useNavigate, useParams} from "@solidjs/router";
import {createAssignment, CustomAssignment, getApi} from "../api/Api";
import {Accessor, createEffect, createMemo, createSignal, For, on, Setter, Show} from "solid-js";
import Icon from "../components/icons/Icon";
import Xmark from "../components/icons/svg/Xmark";
import {MeasureType} from "../api/types";
import Plus from "../components/icons/svg/Plus";
import Loading from "../components/Loading";
import ChevronUp from "../components/icons/svg/ChevronUp";
import {isMCPS} from "../utils";

const NOT_FOR_GRADING = 'not-for-grading'

function sanitizeCategoryType(category: string) {
  if (!isMCPS()) return category
  switch (category) {
    case 'All Tasks / Assessments': return 'All Tasks'
    case 'Practice / Preparation': return 'Practice/Prep'
    default: return category
  }
}

const transform = (value: string) => parseFloat(value.replaceAll(',', '')).toString()

type AssignmentProps = {
  assignment: CustomAssignment,
  idx: Accessor<number>,
  setAssignments: Setter<CustomAssignment[]>,
  ack: Setter<boolean>,
}

function AssignmentDetails(props: AssignmentProps) {
  const api = getApi()!
  const {gradingPeriod, courseId} = useParams()
  const key = `${gradingPeriod}:${courseId}`

  const [name, setName] = createSignal(props.assignment.name)
  const [category, setCategory] = createSignal(props.assignment.category)
  const [score, setScore] = createSignal(props.assignment.score)
  const [maxScore, setMaxScore] = createSignal(props.assignment.maxScore)
  const [measureTypeId, setMeasureTypeId] = createSignal(props.assignment.measureTypeId)
  const [forGrading, setForGrading] = createSignal(props.assignment.isForGrading)

  const ratio = createMemo(() => parseFloat(score()!) / parseFloat(maxScore()))
  const formattedPercent = createMemo(() => isNaN(ratio())
    ? '-'
    : new Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 2}).format(ratio())
  )

  const dueDate = props.assignment.dueDate
  const scoreType = props.assignment.reportCardScoreTypeId

  createEffect(on(
    [name, category, score, maxScore, measureTypeId, forGrading],
    ([name, category, score, maxScore, measureTypeId, forGrading]) => {
      const updated = {
        ...props.assignment,
        name,
        category,
        score,
        maxScore,
        measureTypeId,
        isForGrading: forGrading,
      }
      const course = api.modifiedCourses.get(key)!
      const modified = course.assignments.map((old, j) => (
        props.idx() == j ? updated : {...old}
      ))
      props.ack(false)
      api.modifiedCourses.set(key, { assignments: modified, needsRollback: true })
    },
    { defer: true }
  ))

  let categorySelectRef: HTMLSelectElement | null = null

  return (
    <tr class="transition hover:bg-fg/5 [&+tr]:border-t-[1px] border-bg-3">
      <td class="text-sm px-2 py-3 break-words">
        <h2>{name() ?? 'Unnamed Assignment'}</h2>
        <span class="font-light text-xs text-fg/60">{dueDate}</span>
      </td>
      <td class="text-center">
        <div class="w-full relative">
          <select
            name="category"
            class="absolute opacity-0 inset-0 w-full h-full z-50 cursor-pointer"
            ref={categorySelectRef!}
            onChange={() => {
              if (categorySelectRef!.value == NOT_FOR_GRADING)
                return setForGrading(false)

              const value = parseInt(categorySelectRef!.value)
              setMeasureTypeId(value)
              const name = api.policy.measureTypes.find(m => m.id == value)!.name
              setCategory(name)
              setForGrading(true)
            }}
          >
            <For each={api.policy.measureTypes}>
              {measureType => (
                <option value={measureType.id} selected={forGrading() && measureTypeId() == measureType.id}>
                  {measureType.name}
                </option>
              )}
            </For>
            <option value={NOT_FOR_GRADING} selected={!forGrading()}>Not for Grading</option>
          </select>
          <button class="w-full flex items-center justify-center">
            {forGrading() ? (
              <span class="font-light text-sm">
                {sanitizeCategoryType(category())}
              </span>
            ) : (
              <span class="font-light text-sm text-highlight">Not for Grading</span>
            )}
            <Icon icon={ChevronUp} class="transform rotate-180 ml-1.5 w-3 h-3 fill-fg" />
          </button>
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
          const modified = api.modifiedCourses.get(key)!.assignments.filter((_, j) => j != props.idx())
          api.modifiedCourses.set(key, { assignments: modified, needsRollback: true })
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

function WeightProgressBar(props: WPBProps) {
  const api = getApi()!
  const points = createMemo(() => api.totalAssignmentPoints(props.gradingPeriod, props.courseId, props.measureType.id))
  const maxPoints = createMemo(() => api.maxAssignmentPoints(props.gradingPeriod, props.courseId, props.measureType.id))

  const ratio = () => points() / maxPoints()
  const style = () => api.calculateScoreStyle(props.scoreType, ratio())

  return (
    <Show when={points() || maxPoints()}>
      <div class="relative flex-grow mx-2 mt-2 bg-bg-3/80 rounded-lg h-12 overflow-hidden">
        <div
          class="opacity-20 h-full"
          style={{ width: `${Math.max(0.0, Math.min(1.0, ratio())) * 100}%`, background: `rgb(var(--c-${style()}))` }}
        />
        <div class="absolute z-10 flex px-3 inset-0 w-full h-full items-center justify-between">
          <h2 class="font-title font-bold text-medium">{props.measureType.name}</h2>
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
    </Show>
  )
}

export default function CourseDetails() {
  const api = getApi()!
  const params = useParams()
  const navigate = useNavigate()

  const gradingPeriod = () => params.gradingPeriod ?? api.defaultGradingPeriod
  const key = () => `${gradingPeriod()}:${params.courseId}`

  createEffect(async () => {
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
      <CourseDetailsInner />
    </Show>
  )
}

export function CourseDetailsInner() {
  const api = getApi()!
  const params = useParams()
  const key = () => `${params.gradingPeriod}:${params.courseId}`

  const course = createMemo(() => api.courses.get(key()))
  const metadata = createMemo(() => (
    api.courseOrders.get(params.gradingPeriod)!.find(course => course.ID.toString() == params.courseId)!
  ))
  const [assignments, setAssignments] = createSignal<CustomAssignment[]>([])

  const scoreType = createMemo(() => course()!.classGrades[0].reportCardScoreTypeId)
  const ratio = createMemo(() => api.calculateWeightedPointRatio(params.gradingPeriod, parseInt(params.courseId)))
  const style = createMemo(() => ({color: `rgb(var(--c-${api.calculateScoreStyle(scoreType()!, ratio()!)}))`}))
  const mark = createMemo(() => api.calculateMark(scoreType()!, ratio()!))

  createEffect(() => {
    if (course() && !assignments()?.length) {
      setAssignments(api.modifiedCourses.get(key())!.assignments)
    }
  })

  const [acked, setAcked] = createSignal(true)
  const [needsRollback, setNeedsRollback] = createSignal(false)

  createEffect(on(
    [assignments, needsRollback], ([assignments, needsRollback]) => {
      setAcked(false)
      api.modifiedCourses.set(key(), { assignments, needsRollback })
    },
    { defer: true }
  ))

  createEffect(on(
    () => api.modifiedCourses.get(key()), (updated) => {
      if (!acked()) return setAcked(true)
      if (updated != null) {
        setAssignments(updated.assignments)
        setNeedsRollback(updated.needsRollback)
      }
    },
    { defer: true }
  ))

  return (
    <>
      <div class="flex justify-between p-4 bg-bg-0/80 mx-2 mt-2 rounded-lg">
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
      <div class="flex flex-col">
        <For each={api.policy.measureTypes}>
          {(measureType) => (
            <WeightProgressBar
              gradingPeriod={params.gradingPeriod}
              courseId={parseInt(params.courseId)}
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
                <th scope="col" class="px-4 mobile:px-1">
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
                    setNeedsRollback(true)
                  }}>
                    <Icon icon={Plus} class="fill-fg w-4 h-4 hover:fill-accent transition" tooltip="Add Assignment" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={assignments()} fallback="No assignments yet!">
                {(assignment, idx) => (
                  <AssignmentDetails
                    assignment={assignment}
                    idx={idx}
                    setAssignments={setAssignments}
                    ack={setAcked}
                  />
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}