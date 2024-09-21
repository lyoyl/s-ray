import { esbuildPlugin } from '@web/dev-server-esbuild';
import { URL, fileURLToPath } from 'url';
import { baseConfig } from './web-test-runner.config.js';

const entryHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>My first lyoyl app</title>
  <!-- placeholder for test -->
</head>

<body>
  <my-app>
    <template shadowrootmode="open"><!--[0--->
      <button ref="$$--dynamic0--$$" @click="$$--dynamic1--$$">Update</button>
      <ul>
        <!--[[1-2--><!--[2--->
        <li #data-id="$$--dynamic0--$$" data-id="1" :prop="$$--dynamic1--$$">Name: <!--%0-2-->Apple<!--0-2%--><!--^-->; ID: <!--%1-3-->1<!--1-3%--><!--^--></li>
        <input>
      <!--2-]--><!--[3--->
        <li #data-id="$$--dynamic0--$$" data-id="2" :prop="$$--dynamic1--$$">Name: <!--%2-2-->Banana<!--2-2%--><!--^-->; ID: <!--%3-3-->2<!--3-3%--><!--^--></li>
        <input>
      <!--3-]--><!--[4--->
        <li #data-id="$$--dynamic0--$$" data-id="3" :prop="$$--dynamic1--$$">Name: <!--%4-2-->Cherry<!--4-2%--><!--^-->; ID: <!--%5-3-->3<!--5-3%--><!--^--></li>
        <input>
      <!--4-]--><!--1-2]]--><!--^-->
        <my-component><template shadowrootmode="open"><!--[5--->
      <p>State: <!--%6-0-->0<!--6-0%--><!--^--></p>
      <p>Double: <!--%7-1-->0<!--7-1%--><!--^--></p>
      <button @click="$$--dynamic2--$$">Increment</button>

      <my-button><template shadowrootmode="open"><!--[6--->
      <button ?disabled="$$--dynamic0--$$" disabled>
        <slot></slot>
      </button>
    <!--6-]--></template>Click me</my-button>
    <!--5-]--></template></my-component>
        <!--[7-3--><footer @click="$$--dynamic0--$$">footer</footer><!--7-3]--><!--^-->
      </ul>
    <!--0-]--></template>
  </my-app>
</body>

</html>
`;

export default {
  ...baseConfig,
  files: ['src/ssr/**/hydrating.spec.ts'],
  plugins: [
    esbuildPlugin({
      ts: true,
      tsconfig: fileURLToPath(
        new URL('./tsconfig.json', import.meta.url),
      ),
      target: 'auto',
      define: {
        '__ENV__': JSON.stringify('development'),
        '__SSR__': JSON.stringify(false),
      },
    }),
  ],
  testRunnerHtml: (testRunnerImport) => {
    return entryHTML.replace(
      '<!-- placeholder for test -->',
      `
      <script type="module" src="${testRunnerImport}"></script>
    `,
    );
  },
};
