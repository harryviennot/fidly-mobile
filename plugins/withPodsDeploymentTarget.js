// Raises every pod target's iOS deployment target to the app's own minimum. Some pods still
// declare iOS 9 to 13, and newer Xcode refuses any target below the range it supports.
const { withPodfile } = require("expo/config-plugins");

const HOOK = "post_install do |installer|";
const MARKER = "# withPodsDeploymentTarget";

const BLOCK = `
    ${MARKER}
    minimum = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '15.1')
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build|
        current = build.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current && Gem::Version.new(current) < minimum
          build.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum.to_s
        end
      end
    end
`;

function raisePodsDeploymentTarget(podfile) {
  if (podfile.includes(MARKER)) return podfile;
  const at = podfile.indexOf(HOOK);
  if (at === -1) {
    throw new Error(`withPodsDeploymentTarget: the Podfile has no "${HOOK}" hook to extend.`);
  }
  const end = at + HOOK.length;
  return podfile.slice(0, end) + BLOCK + podfile.slice(end);
}

function withPodsDeploymentTarget(config) {
  return withPodfile(config, (cfg) => {
    cfg.modResults.contents = raisePodsDeploymentTarget(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withPodsDeploymentTarget;
module.exports.raisePodsDeploymentTarget = raisePodsDeploymentTarget;
