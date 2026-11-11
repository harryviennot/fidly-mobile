import { describe, expect, it } from "bun:test";
import { raisePodsDeploymentTarget } from "./withPodsDeploymentTarget";

// The post_install hook as `expo prebuild` writes it for SDK 54.
const EXPO_PODFILE = `platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'

target 'StampeoScanner' do
  use_react_native!(
    :path => config[:reactNativePath],
  )

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

describe("raisePodsDeploymentTarget", () => {
  it("raises every pod target below the app's minimum, first thing in the post_install hook", () => {
    const podfile = raisePodsDeploymentTarget(EXPO_PODFILE);

    const hook = podfile.indexOf("post_install do |installer|");
    const raise = podfile.indexOf("installer.pods_project.targets.each");
    const reactNative = podfile.indexOf("react_native_post_install(");
    expect(hook).toBeGreaterThan(-1);
    expect(raise).toBeGreaterThan(hook);
    expect(raise).toBeLessThan(reactNative);
    // The same minimum the app's own platform line reads.
    expect(podfile).toContain("Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '15.1')");
    expect(podfile).toContain("build.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum.to_s");
  });

  it("adds the block once when prebuild runs again on the same Podfile", () => {
    const once = raisePodsDeploymentTarget(EXPO_PODFILE);
    const twice = raisePodsDeploymentTarget(once);

    expect(twice).toBe(once);
    expect(twice.split("installer.pods_project.targets.each").length).toBe(2);
  });

  it("fails the build when the Podfile has no post_install hook to extend", () => {
    expect(() => raisePodsDeploymentTarget("platform :ios, '15.1'\n")).toThrow(/post_install/);
  });
});
