import {createAssignment, CustomAssignment, getApi, Gradebook} from "../api/Api";
import {Accessor, createEffect, createMemo, createSignal, For, on, Setter, Show} from "solid-js";
import Icon from "../components/icons/Icon";
import Xmark from "../components/icons/svg/Xmark";
import Plus from "../components/icons/svg/Plus";
import ChevronUp from "../components/icons/svg/ChevronUp";
import {useNumericParams} from "../utils";

import tooltip from "../directives/tooltip";
import CaretUp from "../components/icons/svg/CaretUp";
import CaretDown from "../components/icons/svg/CaretDown";
import {Weight} from "../api/WeightingPolicy";
void tooltip

const NOT_FOR_GRADING = 'not-for-grading'

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
  const {gradingPeriod, courseId} = useNumericParams()
  const key = () => `${gradingPeriod()!}:${courseId()!}` as const

  const modifiedCourse = () => gradebook.modifiedCourses.get(key())

  const [name, setName] = createSignal(props.assignment.name ?? 'Unnamed Assignment')
  const [category, setCategory] = createSignal(props.assignment.type)
  const [score, setScore] = createSignal(props.assignment.score)
  const [maxScore, setMaxScore] = createSignal(props.assignment.maxScore)
  const [forGrading, setForGrading] = createSignal(!props.assignment.notForGrading)

  const formatPercent = (r: number) => new Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 2}).format(r)

  const ratio = createMemo(() => score()! / maxScore()!)
  const weight = () => gradebook.weighting.weights.get(category())
  const formattedPercent = createMemo(() => isNaN(ratio()) ? '-' : formatPercent(ratio()))

  const gradebook = props.gradebook
  const impact = createMemo(() => score() == null || !forGrading() ? NaN : (
    props.baseRatio - gradebook.calculateWeightedPointRatio(
      gradingPeriod()!, courseId()!, { [category()]: [-score()!, -maxScore()!] }
    )
  ))
  const dueDate = props.assignment.dueDate

  createEffect(on(
    [name, category, score, maxScore, forGrading],
    ([name, category, score, maxScore, forGrading]) => {
      const updated = {
        ...props.assignment,
        name,
        type: category,
        score,
        maxScore,
        notForGrading: !forGrading,
      }
      const modified = modifiedCourse()!.assignments.map((old, j) => (
        props.idx() == j ? updated : {...old}
      ))
      props.ack(false)
      const old = gradebook.modifiedCourses.get(key())!
      gradebook.modifiedCourses.set(key(), { ...old, assignments: modified, needsRollback: true })
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

              setCategory(categorySelectRef!.value)
              setForGrading(true)
            }}
          >
            <For each={[...gradebook.weighting.weights.values()]}>
              {(weight) => (
                <option value={weight.name} selected={forGrading() && category() == weight.name}>
                  {weight.name}
                </option>
              )}
            </For>
            <option value={NOT_FOR_GRADING} selected={!forGrading()}>Not for Grading</option>
          </select>
          <button class="w-full flex items-center justify-center">
            {forGrading() ? (
              <>
                <span class="font-light text-sm block mobile:hidden">{weight()?.colloquial ?? category()}</span>
                <span class="font-light text-sm hidden mobile:block">{weight()?.short ?? category()}</span>
              </>
            ) : (
              <>
                <span class="font-light text-sm text-highlight block mobile:hidden">Not for Grading</span>
                <span class="font-light text-sm text-highlight hidden mobile:block">--</span>
              </>
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
              onClick={() => setScore(0)}
            >
              <span class="text-sm group-hover:hidden">Not Graded</span>
              <span class="text-sm hidden group-hover:block">Add Score</span>
              <span class="text-xs font-light text-white/70">
                {(maxScore() ?? 0).toLocaleString()} Pts Possible
              </span>
            </button>
          </div>
        }>
          <h2 class="mt-1" use:tooltip={score() == null ? '-' : formattedPercent()}>
            <sup>
              <input
                style={{
                  color: `rgb(${gradebook.policy.getMark(ratio()).color})`,
                  width: `${transform(score()?.toString() ?? '0').length}ch`,
                }}
                class="font-bold text-base text-right focus:outline-none bg-transparent"
                type="number"
                inputMode="decimal"
                value={score() ?? 0}
                onInput={e => {
                  if (e.currentTarget.value === '') return setScore(0)
                  setScore(parseFloat(e.currentTarget.value as any))
                }}
              />
            </sup>
            <span class="text-fg/70 font-light text-lg">&frasl;</span>
            <sub>
              <input
                style={{width: `${transform(maxScore()?.toString() ?? '0').length}ch`}}
                class="text-fg/60 font-light text-sm focus:outline-none bg-transparent"
                type="number"
                inputMode="decimal"
                value={maxScore() ?? 0}
                onInput={e => {
                  if (e.currentTarget.value === '') return setScore(1)
                  setMaxScore(parseFloat(e.currentTarget.value as any))
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
          const old = modifiedCourse()!
          const modified = old.assignments.filter((_, j) => j != props.idx())
          gradebook.modifiedCourses.set(key(), { ...old, assignments: modified, needsRollback: true })
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
  gradebook: Gradebook, gradingPeriod: number, courseId: number, policy: Weight
}

function WeightProgressBar(props: WPBProps) {
  const points = createMemo(() =>
    props.gradebook.totalAssignmentPoints(props.gradingPeriod, props.courseId, props.policy.name))
  const maxPoints = createMemo(() =>
    props.gradebook.maxAssignmentPoints(props.gradingPeriod, props.courseId, props.policy.name))

  const ratio = () => points() / maxPoints()
  const style = () => props.gradebook.policy.getMark(ratio()).color

  return (
    <Show when={points() || maxPoints()}>
      <div class="relative flex-grow mx-2 mt-2 bg-bg-3/80 rounded-lg h-12 overflow-hidden">
        <div
          class="opacity-20 h-full"
          style={{ width: `${Math.max(0.0, Math.min(1.0, ratio())) * 100}%`, background: `rgb(${style()})` }}
        />
        <div class="absolute z-10 flex px-3 inset-0 w-full h-full items-center justify-between">
          <h2 class="font-title font-bold text-medium block mobile:hidden">{props.policy.name}</h2>
          <h2 class="font-title font-bold text-medium hidden mobile:block">{props.policy.colloquial}</h2>
          <div class="flex items-center">
            <div class="mt-1 mr-8 mobile-xs:mr-0">
              <sup class="font-bold text-base text-right">{points()}</sup>
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

  const {gradingPeriod, courseId} = useNumericParams()
  const key = () => `${gradingPeriod()!}:${courseId()!}` as const

  const course = createMemo(() => gradebook.courses.get(key()))
  const ratio = createMemo(() => gradebook.calculateWeightedPointRatio(gradingPeriod()!, courseId()!))
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
      const old = gradebook.modifiedCourses.get(key())!
      gradebook.modifiedCourses.set(key(), { ...old, assignments, needsRollback })
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
    const weightType = gradebook.weighting.weights.values().next()
    const dummyAssignment = createAssignment({
      gradebookId: 0,
      name: 'New Assignment',
      type: weightType.value?.name ?? 'Assignment',
      date: 'Custom Assignment',
      dueDate: 'Custom Assignment',
      description: null,
      notForGrading: false,
      score: 0,
      maxScore: 0,
    }, true)
    const modified = [dummyAssignment, ...gradebook.modifiedCourses.get(key())!.assignments]
    setAssignments(modified)
    setNeedsRollback(true)
  }

  return (
    <div class="flex flex-col overflow-auto">
      <div class="flex flex-col">
        <For each={[...gradebook.weighting.weights.values()]}>
          {(policy) => (
            <WeightProgressBar
              gradebook={gradebook}
              gradingPeriod={gradingPeriod()!}
              courseId={courseId()!}
              policy={policy}
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
                  <th scope="col" class="px-4 mobile:px-0">Type</th>
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
