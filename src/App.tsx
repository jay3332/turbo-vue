import {Component, lazy, onMount, Show} from 'solid-js';
import {Router, Route, useLocation, Navigate, useNavigate} from "@solidjs/router";

import {Api, getApi, setApi} from "./api/Api";
import Layout from "./Layout";

import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';
import Loading from "./components/Loading";

const Login = lazy(() => import('./pages/Login'));
const SelectDistrict = lazy(() => import('./pages/SelectDistrict'));

const RedirectingLogin = lazy(async () => {
  const redirectTo = useLocation().pathname
  return {
    default: () => localStorage.getItem('token')
      ? <Navigate href="/refresh-mount" state={{redirectTo}} />
      : <Navigate href="/" state={{redirectTo}} />
  }
})

function RefreshMount() {
  const navigate = useNavigate()
  const redirectTo = useLocation<{ redirectTo: string }>().state?.redirectTo ?? '/'

  onMount(() => {
    const token = localStorage.getItem('token');

    if (token != null && !getApi()) {
      Api.fromToken(token).then((api) => {
        setApi(api)
        navigate(redirectTo)
      }, () => {
        localStorage.removeItem('token')
        window.location.href = '/'
      })
    }
  })

  return <Loading />
}

const Grades = lazy(() => import('./pages/Grades'))
const About = lazy(() => import('./pages/About'))
const CourseLayout = lazy(() => import('./pages/CourseLayout'))
const Assignments = lazy(() => import('./pages/Assignments'))
const Analyze = lazy(() => import('./pages/Analyze'))
const Optimize = lazy(() => import('./pages/Optimize'))

const App: Component = () => {
  return (
    <main class="relative font-sans m-0 w-[100vw] h-[100vh] overflow-hidden bg-2 text-fg">
      <Router>
        <Show when={getApi()} fallback={
          <>
            <Route path="/" component={Login} />
            <Route path="/select-district" component={SelectDistrict} />
            <Route path="/refresh-mount" component={RefreshMount} />
            <Route path="*" component={RedirectingLogin} />
          </>
        }>
          <Route component={Layout}>
            <Route path={["/", "/grades/:gradingPeriod"]} component={Grades} />
            <Route path={"/about"} component={About} />
            <Route path="/grades/:gradingPeriod/:courseId" component={CourseLayout}>
              <Route path="/" component={Assignments} />
              <Route path="/analyze" component={Analyze} />
              <Route path="/optimize" component={Optimize} />
            </Route>
          </Route>
          <Route path="*" component={() => <Navigate href="/" />} />
        </Show>
      </Router>
    </main>
  );
};

export default App;
