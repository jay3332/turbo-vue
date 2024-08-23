import {getApi, Gradebook} from "../api/Api";
import {createEffect, For, onMount, Show} from "solid-js";
import {ScheduleClass, Schedules} from "../api/types";
import {isMCPS, normalizeQualifiedClassName} from "../utils";
import {createMediaQuery} from "@solid-primitives/media";

function tryInferLunchPeriod(classes: ScheduleClass[]): ScheduleClass[] {
  if (!isMCPS()) return classes
  if (classes.some(cls => /\blunch\b/gi.test(cls.className))) return classes

  // A lunch period is inferred if there is a gap of at least 30 minutes between two classes and the gap is between
  // 10:30 AM and 1:30 PM
  const resolved: ScheduleClass[] = []

  for (let i = 0; i < classes.length; i++) {
    resolved.push(classes[i])
    if (i + 1 < classes.length) {
      const current = classes[i]
      const next = classes[i + 1]
      const currentEnd = new Date(`01/01/2000 ${current.endTime}`).getTime()
      const nextStart = new Date(`01/01/2000 ${next.startTime}`).getTime()

      if (currentEnd <= new Date('01/01/2000 10:30 AM').getTime()) continue
      if (nextStart >= new Date('01/01/2000 1:30 PM').getTime()) continue

      if (nextStart - currentEnd >= 30 * 60 * 1000) {
        resolved.push({
          period: 'Lunch',
          className: 'Lunch',
          teacherNameFNLN: '',
          roomName: '',
          startTime: new Date(currentEnd + 1).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          endTime: new Date(nextStart - 1).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        } as any)
      }
    }
  }
  return resolved
}

function ScheduleInner({ schedules }: { schedules: Schedules }) {
  const api = getApi()!
  const gradebook = () => api.gradebook
  const schedule = () => schedules.schools[0]
  const isMobile = createMediaQuery('(max-width: 768px)')

  return (
    <>
      <div class="rounded-xl bg-0 p-4 flex flex-col mb-2">
        <h2 class="font-title text-lg font-medium">
          Schedule for {new Date(Date.parse(schedules.date)).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
        </h2>
        <p class="text-fg/60 font-light text-sm">{schedule().bellSchedName}</p>
      </div>
      <div class="rounded-xl overflow-hidden">
        <table class="w-full">
          <thead class="bg-0 font-title">
            <tr>
              <th></th>
              <th></th>
              <th class="md:table-cell hidden">Teacher</th>
              <th class="py-1.5">Room</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            <For each={tryInferLunchPeriod(schedule().classes)}>
              {cls => (
                <tr class="align-middle">
                  <td class="text-center px-2 mobile-xs:px-1.5 py-1">
                    <div class="w-full flex items-center justify-center">
                      <div classList={{
                        "rounded-full p-4 w-6 h-6 mobile:p-3.5 flex items-center justify-center font-title font-bold mobile:text-sm text-fg/60": true,
                        [!Number(cls.period) ? "bg-transparent" : "bg-3"]: true,
                      }}>
                        {!Number(cls.period) ? '' : Number(cls.period)}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="flex flex-col mobile:py-0.5">
                      <span class="font-title text-sm">
                        {normalizeQualifiedClassName(cls.className)}
                      </span>
                      <span class="font-light text-xs text-fg/50 md:hidden block">
                        {cls.teacherNameFNLN}
                      </span>
                    </div>
                  </td>
                  <td class="text-center md:table-cell hidden">
                    <span class="font-light text-sm text-fg/80">{cls.teacherNameFNLN}</span>
                  </td>
                  <td class="text-center">
                    <span class="font-light text-sm text-fg/80">{cls.roomName}</span>
                  </td>
                  <td class="text-center">
                    <span class="font-light text-sm text-fg/80">
                      {isMobile()
                        ? `${cls.startTime} - ${cls.endTime}`.replace(/ [AP]M/gi, '')
                        : `${cls.startTime} - ${cls.endTime}`}
                    </span>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </>
  )
}

function Skeleton() {
  return (
    <div class="rounded-xl bg-0 p-4 flex flex-col mb-2">
      <div class="w-52 h-6 bg-fg/20 rounded-full animate-pulse" />
      <div class="w-28 h-5 bg-fg/10 rounded-full animate-pulse" />
    </div>
  )
}

export default function Schedule() {
  const api = getApi()!

  const updateSchedules = async () => {
    if (api.schedules == null || Date.now() >= Date.parse(api.schedules.date) + 86_400_000) {
      const today = new Date().toLocaleDateString('en-US', {month: 'numeric', day: '2-digit', year: 'numeric'})
      const {data} = await api.request<Schedules>('/schedule/' + today)
      if (data) api.schedules = data
    }
  }
  createEffect(updateSchedules)
  onMount(() => setInterval(updateSchedules, 1_800_000))

  return (
    <div class="p-2">
      <Show when={api.schedules} fallback={<Skeleton />}>
        <ScheduleInner schedules={api.schedules!} />
      </Show>
    </div>
  )
}