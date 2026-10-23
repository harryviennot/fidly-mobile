// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // supabase.auth.signOut() defaults to the global scope, which revokes the
      // user's sessions on every device, other scanner phones included. Every
      // sign-out passes { scope: "local" } explicitly.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='signOut'][callee.object.property.name='auth']:not(:has(Property[key.name='scope'][value.value='local']))",
          message:
            'Pass { scope: "local" } so signing out here leaves the user\'s other devices signed in.',
        },
      ],
    },
  },
]);
