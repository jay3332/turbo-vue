import {createSignal, JSX, onMount, ParentProps} from "solid-js";
import Icon from "./icons/Icon";
import ChevronUp from "./icons/svg/ChevronUp";

export type Props = { options: JSX.Element, optionsClass?: string } & JSX.ButtonHTMLAttributes<JSX.Element>

export default function Dropdown(props: ParentProps<Props>) {
  const [isOpen, setIsOpen] = createSignal(false)

  return (
    <div class="relative">
      <button
        classList={{ "flex items-center p-2": true, [props['class'] ?? '']: true, ...(props.classList ?? {}) }}
        onClick={() => setIsOpen(!isOpen())}
      >
        {props.children}
        <Icon
          icon={ChevronUp}
          class="w-3 h-3 ml-1.5 fill-fg/80 transition-transform duration-200"
          style={{"transform": isOpen() ? "rotate(0deg)" : "rotate(180deg)"}}
        />
      </button>
      <div
        classList={{
          "absolute z-10 mt-2 rounded-lg overflow-hidden dropdown opacity-100 transition": true,
          "hidden opacity-0": !isOpen(),
          [props.optionsClass ?? ""]: true,
        }}
        onClick={() => setIsOpen(false)}
      >
        {props.options}
      </div>
    </div>
  )
}