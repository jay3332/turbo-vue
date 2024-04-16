import Icon from "../components/icons/Icon";
import ChevronLeft from "../components/icons/svg/ChevronLeft";

export default function About() {
  return (
    <div class="flex flex-col items-center">
      <div class="lg:w-[64ch] w-[90%] py-8 mobile:py-4 mobile:px-2 flex flex-col">
        <h2 class="font-title font-bold text-2xl text-center mt-4">About TurboVUE</h2>
        <p class="text-center pt-4 text-fg/70">
          TurboVUE was created to improve on the sub-par user experience of StudentVUE, allowing you to view and analyze
          your grades and assignments through a clean, fast, and lightweight client.
        </p>
        <p class="text-center text-sm pt-4 text-fg/50">
          TurboVUE is not affiliated with Edupoint, the creators of StudentVUE.
          <br />
          This is a project by <a href="//jay3332.tech" class="underline underline-offset-2">Jaysen Tsao</a>
        </p>
        <h3 class="font-title font-bold text-xl text-center mt-8 [word-spacing:3px]">TurboVUE is open source!</h3>
        <p class="text-center pt-4 text-fg/70">
          You can view the source code on GitHub and contribute to the project by reporting issues or submitting pull requests.
        </p>
        <div class="flex gap-x-2 w-full py-2 justify-center mobile:flex-col">
          <a href="//github.com/jay3332/turbo-vue/issues/new/choose" class="btn btn-sm btn-ghost">
            Report a bug/issue
            <Icon icon={ChevronLeft} class="transform rotate-180 w-3.5 h-3.5 ml-0.5 fill-fg" />
          </a>
          <a href="//github.com/jay3332/turbo-vue" class="btn btn-sm btn-ghost">
            View repository
            <Icon icon={ChevronLeft} class="transform rotate-180 w-3.5 h-3.5 ml-0.5 fill-fg" />
          </a>
        </div>
        <h3 class="font-title font-bold text-xl text-center mt-8 [word-spacing:3px]">Using TurboVUE on school networks</h3>
        <p class="text-center pt-4 text-fg/70">
          The grades.jay3332.tech domain is blocked on some school networks. If you are unable to access TurboVUE
          on your school network, you can use the <a href="//turbo-vue.github.io" class="underline underline-offset-2">github.io</a> domain instead.
          Note that this proxies all requests through a worker and will be slower than using grades.jay3332.tech directly.
        </p>
        <div class="flex justify-center w-full p-2">
          <a href="//turbo-vue.github.io" class="btn btn-sm btn-ghost">
            Visit firewalled TurboVUE
            <Icon icon={ChevronLeft} class="transform rotate-180 w-3.5 h-3.5 ml-0.5 fill-fg"/>
          </a>
        </div>
      </div>
    </div>
  )
}
