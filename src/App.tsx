import {Component, createEffect, lazy, onMount, Show} from 'solid-js';
import {Router, Route, useLocation, Navigate, useNavigate} from "@solidjs/router";

import {Api, getApi, setApi} from "./api/Api";
import Layout from "./Layout";

import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';

const Login = lazy(() => import('./pages/Login'));
const SelectDistrict = lazy(() => import('./pages/SelectDistrict'));

const RedirectingLogin = lazy(async () => {
  const redirectTo = useLocation().pathname
  return {
    default: () => <Navigate href="/" state={{redirectTo}} />
  }
})

function RefreshMount() {
  const navigate = useNavigate()
  const redirectTo = useLocation().pathname

  onMount(() => {
    const token = localStorage.getItem('token');
    // const district = localStorage.getItem('preferredHost');
    // const host = district ? JSON.parse(district).host : 'https://md-mcps-psv.edupoint.com';

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

  return null
}

const Grades = lazy(() => import('./pages/Grades'))
const CourseDetails = lazy(() => import('./pages/CourseDetails'))

const App: Component = () => {
  return (
    <main class="relative font-sans m-0 w-[100vw] h-[100vh] overflow-hidden bg-2 text-fg">
      <Router>
        <Show when={getApi()} fallback={
          <>
            <Router>
              <Route path="*" component={RefreshMount} />
            </Router>
            <Route path="/" component={Login} />
            <Route path="/select-district" component={SelectDistrict} />
            <Route path="*" component={RedirectingLogin} />
          </>
        }>
          <Route component={Layout}>
            <Route path={["/", "/grades/:gradingPeriod"]} component={Grades} />
            <Route path="/grades/:gradingPeriod/:courseId" component={CourseDetails} />
          </Route>
          <Route path="*" component={() => <Navigate href="/" />} />
        </Show>
      </Router>
    </main>
  );
};

export default App;
