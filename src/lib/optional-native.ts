/**
 * Loading a native module that may not exist in the running binary.
 *
 * A plain top-level import of a native module is all-or-nothing: if the module
 * is missing, `TurboModuleRegistry.getEnforcing` throws while the file is being
 * evaluated, which takes down every module that imports it. In this app that
 * meant one absent module made *every* route fail to export a component and the
 * whole app died, rather than just the one button that needed it.
 *
 * That happens for real reasons, not just mistakes: Expo Go carries a fixed set
 * of modules and no third-party ones, so anything opened there is missing
 * @react-native-google-signin by definition.
 *
 * Pure module with no React Native imports so it stays unit-testable.
 */

export interface OptionalModule<T> {
  module: T | null;
  available: boolean;
}

/**
 * Run a module loader, treating a throw as "not in this binary".
 *
 * `isReady` is an extra check for the case where the module resolves but its
 * native half did not register, so the export exists and is useless.
 */
export function loadOptionalModule<T>(
  load: () => T,
  isReady: (module: T) => boolean = () => true
): OptionalModule<T> {
  try {
    const module = load();
    if (!module || !isReady(module)) {
      return { module: null, available: false };
    }
    return { module, available: true };
  } catch {
    return { module: null, available: false };
  }
}
