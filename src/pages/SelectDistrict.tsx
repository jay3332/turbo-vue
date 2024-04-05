import Layout from "./Layout";
import {Api} from "../api/Api";
import {createSignal, For, Show} from "solid-js";
import {useLocation, useNavigate} from "@solidjs/router";
import {DistrictInfo} from "../api/types";

export default function SelectDistrict() {
  let zipRef: HTMLInputElement | null = null

  const redirectTo = useLocation<{ redirectTo: string }>().state?.redirectTo ?? "/"
  const navigate = useNavigate()

  const [queryResults, setQueryResults] = createSignal<DistrictInfo[]>([])
  const [submitTimeout, setSubmitTimeout] = createSignal<NodeJS.Timeout>()

  return (
    <Layout
      title="Select School District"
      redirectTo={redirectTo}
      onSubmit={() => {}}
    >
      <input
        id="zip"
        name="zip"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        placeholder="Enter Zip Code"
        onInput={(event) => {
          if (!event.target.value || event.target.value.length < 5) return

          if (submitTimeout()) clearTimeout(submitTimeout())
          setSubmitTimeout(setTimeout(async () => {
            setSubmitTimeout(undefined)
            Api.fetchDistricts(parseInt(event.target.value)).then(setQueryResults)
          }, 500))
        }}
        class="relative block flex-grow rounded-lg appearance-none px-3 py-2 placeholder-white placeholder-opacity-50
          bg-bg-3 focus:placeholder-accent-light focus:placeholder-opacity-100 focus:z-10 focus:outline-none sm:text-sm"
        ref={zipRef!}
        required
      />

      <Show when={queryResults().length} fallback={
        <span class="mt-4 text-fg/60 text-center">
          {zipRef!.value.length ? 'No results found' : 'Enter a Zip Code to find your school district'}
        </span>
      }>
        <div class="overflow-auto max-h-[40vh] mt-4">
          <div class="flex flex-col -space-y-px rounded-md shadow-sm box-border overflow-hidden gap-[3px]">
            <For each={queryResults()}>
              {(district: DistrictInfo) => (
                <button
                  class="flex flex-col bg-bg-0/70 p-3 transition hover:bg-3 group focus:outline-none"
                  onClick={() => {
                    localStorage.setItem('preferredHost', JSON.stringify(district))
                    navigate('/login')
                  }}
                >
                  <h3 class="font-bold font-title text-left group-focus:text-accent-light transition">
                    {district.name}
                  </h3>
                  <span class="text-sm font-light text-fg/60">{district.address}</span>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </Layout>
  )
}