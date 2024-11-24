import {getApi} from "../api/Api";
import {createEffect, createMemo, For, onMount, Show} from "solid-js";
import {Schedule as ScheduleData, TimeBlock} from "../api/types";
import {normalizeQualifiedClassName} from "../utils";
import {createMediaQuery} from "@solid-primitives/media";

function ScheduleInner({ schedules }: { schedules: ScheduleData }) {
  const schedule = () => schedules.today
  const isMobile = createMediaQuery('(max-width: 768px)')
  const blocks = createMemo(() => {
    if (schedule()) {
      const classes = []
      for (const block of schedule()!.timeBlocks) {
        classes.push({
          ...block,
          ...schedules.classes.find(cls => cls.period === block.period)
        })
      }
      return classes.sort((a, b) => Date.parse(`1/1/2000 ${a.startTime}`) - Date.parse(`1/1/2000 ${b.startTime}`))
    }
    return schedules.classes
  })

  return (
    <>
      <div class="rounded-xl bg-0 p-4 flex flex-col mb-2">
        <h2 class="font-title text-lg font-medium">
          Schedule for {schedule()
            ? new Date(Date.parse(schedule()!.date)).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
            : schedules.termName
          }
        </h2>
        <Show when={schedule()}>
          <p class="text-fg/60 font-light text-sm">{schedule()?.scheduleName}</p>
        </Show>
      </div>
      <div class="rounded-xl overflow-hidden">
        <table class="w-full">
          <thead class="bg-0 font-title">
            <tr>
              <th></th>
              <th></th>
              <th class="md:table-cell hidden">Teacher</th>
              <th class="py-3">Room</th>
              <Show when={schedule()}>
                <th>Time</th>
              </Show>
            </tr>
          </thead>
          <tbody>
            <For each={blocks()}>
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
                    <div class="flex flex-col py-0.5 mobile:py-1">
                      <span class="font-title text-sm">
                        {normalizeQualifiedClassName(cls.name!)}
                      </span>
                      <span class="font-light text-xs text-fg/50 md:hidden block">
                        {cls.teacher}
                      </span>
                    </div>
                  </td>
                  <td class="text-center md:table-cell hidden">
                    <span class="font-light text-sm text-fg/80">{cls.teacher}</span>
                  </td>
                  <td class="text-center">
                    <span class="font-light text-sm text-fg/80">{cls.room}</span>
                  </td>
                  <Show when={schedule()}>
                    <td class="text-center">
                      <span class="font-light text-sm text-fg/80">
                        {isMobile()
                          ? `${(cls as TimeBlock).startTime} - ${(cls as TimeBlock).endTime}`.replace(/ [AP]M/gi, '')
                          : `${(cls as TimeBlock).startTime} - ${(cls as TimeBlock).endTime}`}
                      </span>
                    </td>
                  </Show>
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
    if (api.schedules == null || Date.now() >= Date.parse(api.schedules.today?.date ?? '1/1/1900') + 86_400_000) {
      const {data} = await api.request<ScheduleData>('/schedule')
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