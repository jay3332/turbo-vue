import {Component, lazy, Show} from 'solid-js';
import {Router, Route} from "@solidjs/router";

import {getApi} from "./api/Api";

const Login = lazy(() => import('./pages/Login'));
const SelectDistrict = lazy(() => import('./pages/SelectDistrict'));

const App: Component = () => {
  return (
    <main class="relative font-sans m-0 w-[100vw] h-[100vh] bg-2 text-fg">
      <Show when={getApi()} fallback={
        <Router>
          <Route path={['/', '/login']} component={Login} />
          <Route path="/select-district" component={SelectDistrict} />
        </Router>
      }>
        <Router>

        </Router>
      </Show>
    </main>
  );
};

export default App;
