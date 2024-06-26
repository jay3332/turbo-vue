import {ComponentProps, JSX, ParentProps, Show} from "solid-js";
import {capitalize} from '../utils';

export function FormInput({ id, label, ...props }: { label: string } & ComponentProps<'input'>) {
  return (
    <div>
      <label for={id} class="sr-only">
        {label}
      </label>
      <input
        id={id}
        placeholder={label}
        class="relative block w-full appearance-none px-3 py-2 placeholder-white placeholder-opacity-50 bg-bg-0/70
          focus:placeholder-accent focus:placeholder-opacity-100 focus:z-10 focus:outline-none sm:text-sm"
        {...props}
      />
    </div>
  )
}

export function FormSubmit(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) {
  return(
    <button
      type="submit"
      class="group relative flex w-full justify-center rounded-md border border-transparent bg-accent py-2 px-4
        mt-6 text-sm font-medium hover:bg-opacity-80 transition-all focus:outline-none focus:ring-2
        focus:ring-accent focus:ring-offset-2 disabled:opacity-60"
      {...props}
    />
  )
}

export interface Props {
  title: string;
  error?: string;
  redirectTo: string;
  onSubmit(event: SubmitEvent & { target: HTMLFormElement }): void | Promise<void>;
}

export default function AuthLayout(props: ParentProps<Props>) {
  return (
    <div class="flex min-h-full items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-cover">
      <div class="bg-bg-3/60 px-10 mobile:px-8 py-8 backdrop-blur rounded-lg w-full max-w-md space-y-6 z-10">
        <div class="text-center">
          <a href="https://github.com/jay3332/turbo-vue" class="select-none">
            <img class="mx-auto h-8 w-auto" src="/banner-light.svg" alt="TurboVUE" />
          </a>
          <h2 class="mt-5 text-2xl font-bold font-title">{props.title}</h2>
          <Show when={props.error}>
            <div class="text-red-500">
              <p class="mt-4 font-bold">Something went wrong!</p>
              <p class="text-sm">{capitalize(props.error!)}</p>
            </div>
          </Show>
        </div>
        <form class="flex flex-col" onSubmit={event => {
          event.preventDefault()
          props.onSubmit(event as any)
        }}>
          {props.children}
        </form>
      </div>
    </div>
  )
}