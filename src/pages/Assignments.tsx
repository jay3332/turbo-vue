import {useParams} from "@solidjs/router";
import {createAssignment, CustomAssignment, getApi, Gradebook} from "../api/Api";
import {Accessor, createEffect, createMemo, createSignal, For, on, Setter, Show} from "solid-js";
import Icon from "../components/icons/Icon";
import Xmark from "../components/icons/svg/Xmark";
import {MeasureType} from "../api/types";
import Plus from "../components/icons/svg/Plus";
import ChevronUp from "../components/icons/svg/ChevronUp";
import {isMCPS} from "../utils";

import tooltip from "../directives/tooltip";
import CaretUp from "../components/icons/svg/CaretUp";
import CaretDown from "../components/icons/svg/CaretDown";
void tooltip

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
  gradebook: Gradebook,
  assignment: CustomAssignment,
  idx: Accessor<number>,
  setAssignments: Setter<CustomAssignment[]>,
  ack: Setter<boolean>,
  baseRatio: number,
}

function AssignmentDetails(props: AssignmentProps) {
  const api = getApi()!
  const {gradingPeriod, courseId} = useParams()
  const key = `${gradingPeriod}:${courseId}`

  const [name, setName] = createSignal(props.assignment.name ?? 'Unnamed Assignment')
  const [category, setCategory] = createSignal(props.assignment.category)
  const [score, setScore] = createSignal(props.assignment.score)
  const [maxScore, setMaxScore] = createSignal(props.assignment.maxScore)
  const [measureTypeId, setMeasureTypeId] = createSignal(props.assignment.measureTypeId)
  const [forGrading, setForGrading] = createSignal(props.assignment.isForGrading)

  const formatPercent = (r: number) => new Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 2}).format(r)

  const ratio = createMemo(() => parseFloat(score()!) / parseFloat(maxScore()))
  const formattedPercent = createMemo(() => isNaN(ratio()) ? '-' : formatPercent(ratio()))

  const gradebook = props.gradebook
  const impact = createMemo(() => score() == null || !forGrading() ? NaN : (
    props.baseRatio - gradebook.calculateWeightedPointRatio(
      gradingPeriod, parseInt(courseId), { [measureTypeId()]: [-score()!, -maxScore()] }
    )
  ))

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
      const course = gradebook.modifiedCourses.get(key)!
      const modified = course.assignments.map((old, j) => (
        props.idx() == j ? updated : {...old}
      ))
      props.ack(false)
      gradebook.modifiedCourses.set(key, { assignments: modified, needsRollback: true })
    },
    { defer: true }
  ))

  let categorySelectRef: HTMLSelectElement | null = null

  return (
    <tr class="transition hover:bg-fg/5 [&+tr]:border-t-[1px] border-bg-3">
      <td class="text-sm px-2 py-3 break-words">
        <h2>{name()}</h2>
        <span class="font-light text-xs text-fg/60">{dueDate}</span>
      </td>
      <td class="text-center">
        <div class="w-full relative">
          <select
            name="category"
            class="absolute opacity-0 inset-0 w-full h-full z-50 cursor-pointer bg-0"
            ref={categorySelectRef!}
            onChange={() => {
              if (categorySelectRef!.value == NOT_FOR_GRADING)
                return setForGrading(false)

              const value = parseInt(categorySelectRef!.value)
              setMeasureTypeId(value)
              const name = gradebook.policy.measureTypes.find(m => m.id == value)!.name
              setCategory(name)
              setForGrading(true)
            }}
          >
            <For each={gradebook.policy.measureTypes}>
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
          <h2 class="mt-1" use:tooltip={score() == null ? '-' : formattedPercent()}>
            <sup>
              <input
                style={{
                  color: `rgb(var(--c-${gradebook.calculateScoreStyle(scoreType, ratio())}))`,
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
        <span classList={{
          "flex items-center justify-center gap-x-1": true,
          "text-scale-5 [&_svg]:fill-scale-5": impact() > 0,
          "text-scale-2 [&_svg]:fill-scale-2": impact() < 0 && impact() > -0.05,
          "text-scale-1 [&_svg]:fill-scale-1": impact() <= -0.05,
          "text-fg/60": impact() == 0,
        }}>
          <Show when={score != null && !isNaN(impact()) && impact() != 0}>
            <Icon icon={impact() > 0 ? CaretUp : CaretDown} class="fill-fg w-4 h-4" />
          </Show>
          {score() == null || isNaN(impact()) ? '-' : formatPercent(Math.abs(impact()))}
        </span>
      </td>
      <td class="text-center">
        <button class="mt-1.5" onClick={() => {
          const modified = gradebook.modifiedCourses.get(key)!.assignments.filter((_, j) => j != props.idx())
          gradebook.modifiedCourses.set(key, { assignments: modified, needsRollback: true })
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

type WPBProps = {
  gradebook: Gradebook, gradingPeriod: string, courseId: number, measureType: MeasureType, scoreType: number
}

function WeightProgressBar(props: WPBProps) {
  const points = createMemo(() =>
    props.gradebook.totalAssignmentPoints(props.gradingPeriod, props.courseId, props.measureType.id))
  const maxPoints = createMemo(() =>
    props.gradebook.maxAssignmentPoints(props.gradingPeriod, props.courseId, props.measureType.id))

  const ratio = () => points() / maxPoints()
  const style = () => props.gradebook.calculateScoreStyle(props.scoreType, ratio())

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

export default function Assignments() {
  const api = getApi()!
  const gradebook = api.gradebook!
  const params = useParams()
  const key = () => `${params.gradingPeriod}:${params.courseId}`
  const course = createMemo(() => gradebook.courses.get(key()))
  const scoreType = createMemo(() => course()!.classGrades[0].reportCardScoreTypeId)
  const ratio = createMemo(() => gradebook.calculateWeightedPointRatio(params.gradingPeriod, parseInt(params.courseId)))
  const [assignments, setAssignments] = createSignal<CustomAssignment[]>([])

  createEffect(() => {
    if (course() && !assignments()?.length) {
      setAssignments(gradebook.modifiedCourses.get(key())!.assignments)
    }
  })

  const [acked, setAcked] = createSignal(true)
  const [needsRollback, setNeedsRollback] = createSignal(false)

  createEffect(on(
    [assignments, needsRollback], ([assignments, needsRollback]) => {
      setAcked(false)
      gradebook.modifiedCourses.set(key(), { assignments, needsRollback })
    },
    { defer: true }
  ))

  createEffect(on(
    () => gradebook.modifiedCourses.get(key()), (updated) => {
      if (!acked()) return setAcked(true)
      if (updated != null) {
        setAssignments(updated.assignments)
        setNeedsRollback(updated.needsRollback)
      }
    },
    { defer: true }
  ))

  const addAssignment = () => {
    const measureType = gradebook.policy.measureTypes[0]
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
      studentId: gradebook.policy.students[0].id,
      week: '',
    }, true)
    const modified = [dummyAssignment, ...gradebook.modifiedCourses.get(key())!.assignments]
    setAssignments(modified)
    setNeedsRollback(true)
  }

  return (
    <div class="flex flex-col overflow-auto">
      <div class="flex flex-col">
        <For each={gradebook.policy.measureTypes}>
          {(measureType) => (
            <WeightProgressBar
              gradebook={gradebook}
              gradingPeriod={params.gradingPeriod}
              courseId={parseInt(params.courseId)}
              measureType={measureType}
              scoreType={scoreType()}
            />
          )}
        </For>
      </div>
      <Show when={assignments().length} fallback={
        <p class="flex flex-col flex-grow h-[25vh] gap-y-2 items-center justify-center">
          <span class="font-title text-lg font-bold text-fg/60">No assignments yet...</span>
          <button class="btn btn-primary btn-sm" onClick={addAssignment}>
            <Icon icon={Plus} class="w-4 h-4 mr-2 fill-fg" />
            Add mock assignment
          </button>
        </p>
      }>
        <div class="flex flex-col m-2 relative">
          <button
            class="hidden absolute group hover:bg-accent mobile:flex items-center justify-center
              w-7 h-7 rounded-full top-0 right-0 -m-1 bg-3 z-40"
            onClick={addAssignment}
            use:tooltip="Add Assignment"
          >
            <Icon icon={Plus} class="fill-fg w-4 h-4" />
          </button>
          <div class="overflow-hidden rounded-lg">
            <table class="w-full">
              <thead class="bg-bg-0 font-title">
                <tr class="[&>th]:py-3">
                  <th scope="col" class="w-1/2">Assignment</th>
                  <th scope="col" class="px-4">Category</th>
                  <th scope="col" class="px-4">Score</th>
                  <th class="lg:table-cell hidden">Impact</th>
                  <th scope="col" class="px-2 mobile:px-0">
                    <button class="mobile:hidden flex items-center justify-center w-full h-full" onClick={addAssignment}>
                      <Icon icon={Plus} class="fill-fg w-4 h-4 transition hover:fill-accent" tooltip="Add Assignment" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <For each={assignments()}>
                  {(assignment, idx) => (
                    <AssignmentDetails
                      gradebook={gradebook}
                      assignment={assignment}
                      idx={idx}
                      setAssignments={setAssignments}
                      ack={setAcked}
                      baseRatio={ratio()}
                    />
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>
    </div>
  )
}
