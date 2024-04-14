export default function About() {
  return (
    <div class="flex flex-col items-center">
      <div class="w-[64ch] mobile:w-[90vw] py-8 mobile:py-4 mobile:px-2 flex flex-col">
        <h2 class="font-title font-bold text-2xl text-center mt-4">About TurboVUE</h2>
        <p class="text-center pt-4 text-fg/70">
          TurboVUE was created to improve on the sub-par user experience of StudentVUE, allowing you to view and analyze
          your grades and assignments through a clean, fast, and lightweight client.
        </p>
        <p class="text-center text-sm pt-2 text-fg/50">
          TurboVUE is not affiliated with Edupoint, the creators of StudentVUE.
        </p>
      </div>
    </div>
  )
}
