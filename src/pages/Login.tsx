import AuthLayout, {FormInput, FormSubmit} from "./AuthLayout";
import {Api, getApi, setApi} from "../api/Api";
import {createEffect, createMemo, createSignal} from "solid-js";
import {A, useLocation, useNavigate} from "@solidjs/router";
import {DistrictInfo} from "../api/types";

export default function Login() {
  let usernameRef: HTMLInputElement | null = null
  let passwordRef: HTMLInputElement | null = null
  let rememberMeRef: HTMLInputElement | null = null

  let [error, setError] = createSignal<string>()
  let [isSubmitting, setIsSubmitting] = createSignal(false)

  const redirectTo = useLocation<{ redirectTo: string }>().state?.redirectTo ?? "/"
  const navigate = useNavigate()
  const district = createMemo<DistrictInfo>(() => {
    let hostJson = localStorage.getItem('preferredHost')
    if (hostJson) return JSON.parse(hostJson)
    return {
      name: "Montgomery County Public Schools",
      address: "Rockville MD 20850",
      host: "https://md-mcps-psv.edupoint.com"
    }
  })

  return (
    <AuthLayout
      title="Log in to StudentVUE"
      error={error()}
      redirectTo={redirectTo}
      onSubmit={async () => {
        setIsSubmitting(true)
        const username = usernameRef!.value
        const password = passwordRef!.value

        try {
          let api = await Api.fromLogin(district().host, username, password)
          if (rememberMeRef!.checked) localStorage.setItem("token", api.token);
          setApi(api)
          navigate(redirectTo)
        } catch (e: any) {
          setIsSubmitting(false)
          setError(e.message)
        }
      }}
    >
      <div class="flex flex-col -space-y-px rounded-md shadow-sm box-border overflow-hidden gap-[3px]">
        <FormInput
          id="username"
          name="username"
          type="text"
          autocomplete="username"
          label="Username"
          ref={usernameRef!}
          required
        />
        <FormInput
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          label="Password"
          ref={passwordRef!}
          required
        />
        <A
          class="flex items-center justify-center mt-2 py-2.5 bg-bg-0/70 transition hover:bg-3"
          href='/select-district'
        >
          <span class="font-semibold text-fg/80 font-title text-center text-sm">{district().name}</span>
        </A>
      </div>

      <div class="flex items-center mt-4 mobile-xs:gap-y-2">
        <input
          id="remember-me"
          name="remember-me"
          type="checkbox"
          class="checkbox checkbox-accent"
          checked
          ref={rememberMeRef!}
        />
        <label for="remember-me" class="ml-2 block text-sm">
          Remember me
        </label>
      </div>

      <FormSubmit disabled={isSubmitting()}>
        {isSubmitting() ? "Logging in..." : "Log in"}
      </FormSubmit>
    </AuthLayout>
  )
}