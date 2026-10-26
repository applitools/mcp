# Changelog

All notable changes to the Applitools Eyes MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.1](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.9.0...js/mcp@0.9.1) (2026-10-26)


### Reverts

* update iOS device names for the iOS 27 UFG upgrade | AD-17131 ([#4370](https://github.com/Applitools-Dev/sdk/issues/4370)) ([23905bf](https://github.com/Applitools-Dev/sdk/commit/23905bf242ca47db2223feb271c854ccd9067320))

## [0.9.0](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.8.9...js/mcp@0.9.0) (2026-10-25)


### Features

* update iOS device names for the iOS 27 UFG upgrade | AD-17131 ([#4354](https://github.com/Applitools-Dev/sdk/issues/4354)) ([d825238](https://github.com/Applitools-Dev/sdk/commit/d8252386c111cbf4612c6ea559eecbef0b133fcf))

## [0.8.9](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.8.8...js/mcp@0.8.9) (2026-10-19)


### Bug Fixes

* keep server.json registry versions current on each release | AD-16802 ([#4266](https://github.com/Applitools-Dev/sdk/issues/4266)) ([e61650e](https://github.com/Applitools-Dev/sdk/commit/e61650e6bfe06bf90380a7d1cd832a88740fbdfd))

## [0.8.8](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.8.7...js/mcp@0.8.8) (2026-10-18)


### Dependencies

* @applitools/core-base bumped to 1.41.2
  #### Bug Fixes

  * read the heartbeat processId right before acquire | FLD-4169 ([#4320](https://github.com/Applitools-Dev/sdk/issues/4320)) ([a600eed](https://github.com/Applitools-Dev/sdk/commit/a600eeda613cb87f41d63a3583f7cd06d0602275))

## [0.8.7](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.8.6...js/mcp@0.8.7) (2026-10-13)


### Dependencies

* @applitools/utils bumped to 1.15.3
  #### Bug Fixes

  * publish once to validate the npm trusted publishers ([#4300](https://github.com/Applitools-Dev/sdk/issues/4300)) ([63ebc90](https://github.com/Applitools-Dev/sdk/commit/63ebc9044b150c6f927f626d0ce9cc7da8861441))
* @applitools/eyes-results bumped to 0.2.6

* @applitools/logger bumped to 2.3.2
  #### Bug Fixes

  * publish once to validate the npm trusted publishers ([#4300](https://github.com/Applitools-Dev/sdk/issues/4300)) ([63ebc90](https://github.com/Applitools-Dev/sdk/commit/63ebc9044b150c6f927f626d0ce9cc7da8861441))



* @applitools/image bumped to 1.3.4
  #### Bug Fixes

  * publish once to validate the npm trusted publishers ([#4300](https://github.com/Applitools-Dev/sdk/issues/4300)) ([63ebc90](https://github.com/Applitools-Dev/sdk/commit/63ebc9044b150c6f927f626d0ce9cc7da8861441))



* @applitools/req bumped to 1.11.5

* @applitools/test-server bumped to 1.4.8
  #### Bug Fixes

  * publish once to validate the npm trusted publishers ([#4300](https://github.com/Applitools-Dev/sdk/issues/4300)) ([63ebc90](https://github.com/Applitools-Dev/sdk/commit/63ebc9044b150c6f927f626d0ce9cc7da8861441))



* @applitools/core-base bumped to 1.41.1


## [0.8.6](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.8.5...js/mcp@0.8.6) (2026-10-12)


### Bug Fixes

* keep and announce rootScope | AD-16718 ([#4265](https://github.com/Applitools-Dev/sdk/issues/4265)) ([66a950e](https://github.com/Applitools-Dev/sdk/commit/66a950e1f25c842e240fbdf372a969cfdd641474))


### Code Refactoring

* delete the legacy results tools and keep experimental mode as an empty seam | AD-16751 ([#4261](https://github.com/Applitools-Dev/sdk/issues/4261)) ([81026ad](https://github.com/Applitools-Dev/sdk/commit/81026ad42dc6b3cd7e6d658138333e62d9095687))


### Dependencies

* @applitools/eyes-results bumped to 0.2.5
  #### Bug Fixes

  * keep and announce rootScope | AD-16718 ([#4265](https://github.com/Applitools-Dev/sdk/issues/4265)) ([66a950e](https://github.com/Applitools-Dev/sdk/commit/66a950e1f25c842e240fbdf372a969cfdd641474))



* @applitools/req bumped to 1.11.4
  #### Bug Fixes

  * version-check/telemetry no longer hold the process — connect deadline + unref | AD-16613 ([#4232](https://github.com/Applitools-Dev/sdk/issues/4232)) ([42bcbb5](https://github.com/Applitools-Dev/sdk/commit/42bcbb5dd8d75ad4aa98c2ec0d284f107fdc98e3))
* @applitools/core-base bumped to 1.41.0
  #### Features

  * report NLP step counts per Eyes session | AD-16681 ([#4257](https://github.com/Applitools-Dev/sdk/issues/4257)) ([b84a1cc](https://github.com/Applitools-Dev/sdk/commit/b84a1ccac25c4d61a98ee382a18f54c1011c53e6))


  #### Bug Fixes

  * version-check/telemetry no longer hold the process — connect deadline + unref | AD-16613 ([#4232](https://github.com/Applitools-Dev/sdk/issues/4232)) ([42bcbb5](https://github.com/Applitools-Dev/sdk/commit/42bcbb5dd8d75ad4aa98c2ec0d284f107fdc98e3))




## [0.8.5](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.8.4...js/mcp@0.8.5) (2026-10-01)


### Dependencies

* @applitools/core-base bumped to 1.40.0
  #### Features

  * detect git cherry-picks and report them in StartSession | AD-16372 ([#4235](https://github.com/Applitools-Dev/sdk/issues/4235)) ([92db51e](https://github.com/Applitools-Dev/sdk/commit/92db51e3ea713ee7c59be334d8e11d2c312d1095))

## [0.8.4](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.8.3...js/mcp@0.8.4) (2026-09-17)


### Dependencies

* @applitools/image bumped to 1.3.3
  #### Bug Fixes

  * skip empty slices when framing a stitched screenshot | FLD-4924 ([#4197](https://github.com/Applitools-Dev/sdk/issues/4197)) ([9c160fe](https://github.com/Applitools-Dev/sdk/commit/9c160fe4c2bc60b03105cf6c2c54131f26ea0357))
* @applitools/core-base bumped to 1.39.1


## [0.8.3](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.8.2...js/mcp@0.8.3) (2026-09-15)


### Dependencies

* @applitools/core-base bumped to 1.39.0
  #### Features

  * NLP authoring (eyes.run) for eyes-playwright via the Eyes NLP service | AD-13296 ([#3936](https://github.com/Applitools-Dev/sdk/issues/3936)) ([c0f81d1](https://github.com/Applitools-Dev/sdk/commit/c0f81d1d3237945001ddf918954ee22a962aea03))

## [0.8.2](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.8.1...js/mcp@0.8.2) (2026-09-14)


### Bug Fixes

* lower the eyes-results node floor to 18 ([#4188](https://github.com/Applitools-Dev/sdk/issues/4188)) ([cbd832d](https://github.com/Applitools-Dev/sdk/commit/cbd832db46366d33c4686bf224634d8b17f85845))


### Dependencies

* @applitools/eyes-results bumped to 0.2.4
  #### Bug Fixes

  * lower the eyes-results node floor to 18 ([#4188](https://github.com/Applitools-Dev/sdk/issues/4188)) ([cbd832d](https://github.com/Applitools-Dev/sdk/commit/cbd832db46366d33c4686bf224634d8b17f85845))

## [0.8.1](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.8.0...js/mcp@0.8.1) (2026-09-10)


### Bug Fixes

* replace overlapping match regions and refuse no-op or dynamic masks | AD-15903 ([#4163](https://github.com/Applitools-Dev/sdk/issues/4163)) ([78bdcf1](https://github.com/Applitools-Dev/sdk/commit/78bdcf10aa321252fcd613a685e9a8749a8215ce))


### Dependencies

* @applitools/eyes-results bumped to 0.2.3
  #### Bug Fixes

  * replace overlapping match regions and refuse no-op or dynamic masks | AD-15903 ([#4163](https://github.com/Applitools-Dev/sdk/issues/4163)) ([78bdcf1](https://github.com/Applitools-Dev/sdk/commit/78bdcf10aa321252fcd613a685e9a8749a8215ce))

## [0.8.0](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.7.2...js/mcp@0.8.0) (2026-09-09)


### Features

* Performance - batch diff_report across a step's areas | AD-15976 ([#4150](https://github.com/Applitools-Dev/sdk/issues/4150)) ([ad0d3db](https://github.com/Applitools-Dev/sdk/commit/ad0d3db99d63db0416cbe6e72ed164afb581aff0))

## [0.7.2](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.7.1...js/mcp@0.7.2) (2026-09-08)


### Performance Improvements

* Performance - fold the dom diff and regions into evidence | AD-15975 ([#4149](https://github.com/Applitools-Dev/sdk/issues/4149)) ([b58ef06](https://github.com/Applitools-Dev/sdk/commit/b58ef0621e652caa0f7a6b569a651d8cdb7be03e))

## [0.7.1](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.7.0...js/mcp@0.7.1) (2026-09-06)


### Performance Improvements

* Performance - collect and batch review evidence calls | AD-15949 ([#4147](https://github.com/Applitools-Dev/sdk/issues/4147)) ([1cfe533](https://github.com/Applitools-Dev/sdk/commit/1cfe533f78b7d0bb396d2f8082cd66433f2ae9e0))
* Performance - prune and compress non-diff traversal hops | AD-15950 ([#4148](https://github.com/Applitools-Dev/sdk/issues/4148)) ([a1c0993](https://github.com/Applitools-Dev/sdk/commit/a1c0993ce3794181d98e9bcde5d1532a02a8d0c0))

## [0.7.0](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.6.0...js/mcp@0.7.0) (2026-08-25)


### Features

* telemetry for the eyes-inspect/resolve/review tool families | AD-15731 AD-15732 AD-15733 ([#4122](https://github.com/Applitools-Dev/sdk/issues/4122)) ([5361295](https://github.com/Applitools-Dev/sdk/commit/536129560260ca8853bde89799711068baa6ff3e))


### Bug Fixes

* discover the project .env so the family read/write keys resolve | AD-15678 ([#4131](https://github.com/Applitools-Dev/sdk/issues/4131)) ([316f39f](https://github.com/Applitools-Dev/sdk/commit/316f39fd15fd516b3d266b8aa8deccddfabd0921))


### Dependencies

* @applitools/eyes-results bumped to 0.2.2
  #### Bug Fixes

  * discover the project .env so the family read/write keys resolve | AD-15678 ([#4131](https://github.com/Applitools-Dev/sdk/issues/4131)) ([316f39f](https://github.com/Applitools-Dev/sdk/commit/316f39fd15fd516b3d266b8aa8deccddfabd0921))

## [0.6.0](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.17...js/mcp@0.6.0) (2026-08-24)


### Features

* experimental inspect/resolve/review tools | AD-15678 ([#4104](https://github.com/Applitools-Dev/sdk/issues/4104)) ([3943f55](https://github.com/Applitools-Dev/sdk/commit/3943f55cefc440bb1b1312a66ada475f22d49292))


### Dependencies

* @applitools/eyes-results bumped to 0.2.1
  #### Bug Fixes

  * enhance url support ([#4130](https://github.com/Applitools-Dev/sdk/issues/4130)) ([4dfc0a2](https://github.com/Applitools-Dev/sdk/commit/4dfc0a2553a910278596456f1c764fae72ab2c84))

## [0.5.17](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.16...js/mcp@0.5.17) (2026-08-23)


### Dependencies

* @applitools/image bumped to 1.3.2
  #### Bug Fixes

  * bump sharp to ^0.35.3 to clear libvips advisories | FLD-4829 ([#4113](https://github.com/Applitools-Dev/sdk/issues/4113)) ([90c2d08](https://github.com/Applitools-Dev/sdk/commit/90c2d0824cf3dfe56a074800907da6eb940ba350))
* @applitools/core-base bumped to 1.38.2


## [0.5.16](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.15...js/mcp@0.5.16) (2026-08-10)


### Bug Fixes

* apply the figma UFG environments rewrite to the renders | AD-15528 ([#4072](https://github.com/Applitools-Dev/sdk/issues/4072)) ([bd6b143](https://github.com/Applitools-Dev/sdk/commit/bd6b143f855750ae93701f8e44da6129ff7ae84c))


### Dependencies

* @applitools/utils bumped to 1.15.2
  #### Bug Fixes

  * apply the figma UFG environments rewrite to the renders | AD-15528 ([#4072](https://github.com/Applitools-Dev/sdk/issues/4072)) ([bd6b143](https://github.com/Applitools-Dev/sdk/commit/bd6b143f855750ae93701f8e44da6129ff7ae84c))
* @applitools/logger bumped to 2.3.1
  #### Bug Fixes

  * apply the figma UFG environments rewrite to the renders | AD-15528 ([#4072](https://github.com/Applitools-Dev/sdk/issues/4072)) ([bd6b143](https://github.com/Applitools-Dev/sdk/commit/bd6b143f855750ae93701f8e44da6129ff7ae84c))



* @applitools/req bumped to 1.11.3
  #### Bug Fixes

  * apply the figma UFG environments rewrite to the renders | AD-15528 ([#4072](https://github.com/Applitools-Dev/sdk/issues/4072)) ([bd6b143](https://github.com/Applitools-Dev/sdk/commit/bd6b143f855750ae93701f8e44da6129ff7ae84c))



* @applitools/image bumped to 1.3.1
  #### Bug Fixes

  * apply the figma UFG environments rewrite to the renders | AD-15528 ([#4072](https://github.com/Applitools-Dev/sdk/issues/4072)) ([bd6b143](https://github.com/Applitools-Dev/sdk/commit/bd6b143f855750ae93701f8e44da6129ff7ae84c))



* @applitools/core-base bumped to 1.38.1
  #### Bug Fixes

  * apply the figma UFG environments rewrite to the renders | AD-15528 ([#4072](https://github.com/Applitools-Dev/sdk/issues/4072)) ([bd6b143](https://github.com/Applitools-Dev/sdk/commit/bd6b143f855750ae93701f8e44da6129ff7ae84c))



* @applitools/test-server bumped to 1.4.7


## [0.5.15](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.14...js/mcp@0.5.15) (2026-08-05)


### Dependencies

* @applitools/image bumped to 1.3.0
  #### Features

  * figmaBaselines first-class open-config, in-repo resolver, all SDKs | AD-15462 ([#4021](https://github.com/Applitools-Dev/sdk/issues/4021)) ([998b3b3](https://github.com/Applitools-Dev/sdk/commit/998b3b38486669d2997f9eb11316067abbe85230))
* @applitools/core-base bumped to 1.38.0
  #### Features

  * forward accessibilityReportOptions (axe-core) from render-info into the UFG render request | AD-15104 ([#4004](https://github.com/Applitools-Dev/sdk/issues/4004)) ([eef1b59](https://github.com/Applitools-Dev/sdk/commit/eef1b59feac63a488fdb9e7de73d3063cf43c8ca))




## [0.5.14](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.13...js/mcp@0.5.14) (2026-07-23)


### Dependencies

* @applitools/core-base bumped to 1.37.0
  #### Features

  * adapt extended TestResults fields | AD-14850 ([#4008](https://github.com/Applitools-Dev/sdk/issues/4008)) ([e783db8](https://github.com/Applitools-Dev/sdk/commit/e783db8bfbe25e25126bca5984a29533c9a74d39))


  #### Bug Fixes

  * stop logEventBatch leaking through mainLogger (FLD-4175 regression from [#4007](https://github.com/Applitools-Dev/sdk/issues/4007)) ([#4011](https://github.com/Applitools-Dev/sdk/issues/4011)) ([e595b64](https://github.com/Applitools-Dev/sdk/commit/e595b646e97aba5955d59b0477b608f24aae3f58))

## [0.5.13](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.12...js/mcp@0.5.13) (2026-07-21)


### Dependencies

* @applitools/core-base bumped to 1.36.2
  #### Bug Fixes

  * guard logEventBatch against a logger-less event ([#4007](https://github.com/Applitools-Dev/sdk/issues/4007)) ([bb8c9b2](https://github.com/Applitools-Dev/sdk/commit/bb8c9b242801e08dd573a77e261d5fb4540cd68e))

## [0.5.12](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.11...js/mcp@0.5.12) (2026-07-08)


### Dependencies

* @applitools/core-base bumped to 1.36.1
  #### Bug Fixes

  * forward Exact match-level tuning to the server across JS + Java | FLD-4685 ([#3974](https://github.com/Applitools-Dev/sdk/issues/3974)) ([fea351c](https://github.com/Applitools-Dev/sdk/commit/fea351c76c80f63bf658d9573b3d34e0537e0cce))

## [0.5.11](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.10...js/mcp@0.5.11) (2026-06-28)


### Bug Fixes

* synthesize step label when batch step has no name | AD-14216 ([#3948](https://github.com/Applitools-Dev/sdk/issues/3948)) ([3f59ee9](https://github.com/Applitools-Dev/sdk/commit/3f59ee9ddb9d9bfdd9fc81041a76ee2faf32cef7))


### Dependencies

* @applitools/utils bumped to 1.15.1
  #### Bug Fixes

  * updated extract git fallback logic | FLD-4492 ([#3831](https://github.com/Applitools-Dev/sdk/issues/3831)) ([0d98f3c](https://github.com/Applitools-Dev/sdk/commit/0d98f3cdf828eff756ffbfc5d4cdff7b19a20557))
* @applitools/logger bumped to 2.3.0
  #### Features

  * stream SDK logs to Azure Blob per server flag | AD-13401 ([#3849](https://github.com/Applitools-Dev/sdk/issues/3849)) ([7f9dfec](https://github.com/Applitools-Dev/sdk/commit/7f9dfecd874aefc33104db015451a22eee500324))



* @applitools/req bumped to 1.11.2

* @applitools/image bumped to 1.2.13

* @applitools/core-base bumped to 1.36.0
  #### Features

  * stream SDK logs to Azure Blob per server flag | AD-13401 ([#3849](https://github.com/Applitools-Dev/sdk/issues/3849)) ([7f9dfec](https://github.com/Applitools-Dev/sdk/commit/7f9dfecd874aefc33104db015451a22eee500324))



* @applitools/test-server bumped to 1.4.6


## [0.5.10](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.9...js/mcp@0.5.10) (2026-06-18)


### Bug Fixes

* temporarily disable textual diff descriptions | AD-14248 ([#3918](https://github.com/Applitools-Dev/sdk/issues/3918)) ([3bc8734](https://github.com/Applitools-Dev/sdk/commit/3bc87346bce3b8c3c506e5114d2c0dd2cc470175))


### Dependencies

* @applitools/utils bumped to 1.15.0
  #### Features

  * one-time per-execution summary logEvent in storybook | AD-14305 ([#3911](https://github.com/Applitools-Dev/sdk/issues/3911)) ([59e3a5d](https://github.com/Applitools-Dev/sdk/commit/59e3a5dccf74aa1ac1158024316bd305e3515afa))
* @applitools/logger bumped to 2.2.13

* @applitools/req bumped to 1.11.1
  #### Bug Fixes

  * bundle node-fetch into dist to drop node-domexception dep warning | FLD-4197 ([#3899](https://github.com/Applitools-Dev/sdk/issues/3899)) ([9c3dc52](https://github.com/Applitools-Dev/sdk/commit/9c3dc52866a4a665f1578c39ff43cd0ee5f63492))



* @applitools/image bumped to 1.2.12

* @applitools/core-base bumped to 1.35.3

* @applitools/test-server bumped to 1.4.5


## [0.5.9](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.8...js/mcp@0.5.9) (2026-06-15)


### Dependencies

* @applitools/core-base bumped to 1.35.2
  #### Bug Fixes

  * re-trigger release for packages missed in the AD-14089 release | AD-14089 ([#3925](https://github.com/Applitools-Dev/sdk/issues/3925)) ([0880c34](https://github.com/Applitools-Dev/sdk/commit/0880c34b66221025e70ca7e3e3fab7b45a9f8d9e))

## [0.5.8](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.7...js/mcp@0.5.8) (2026-06-09)


### Dependencies

* @applitools/req bumped to 1.11.0
  #### Features

  * add HTTP/2 proxy support (AD-13916) ([#3860](https://github.com/Applitools-Dev/sdk/issues/3860)) ([87cfb3e](https://github.com/Applitools-Dev/sdk/commit/87cfb3e2772cc8443d961b7916cc701f894b84cb))
* @applitools/core-base bumped to 1.35.1


## [0.5.7](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.6...js/mcp@0.5.7) (2026-06-04)


### Dependencies

* @applitools/core-base bumped to 1.35.0
  #### Features

  * auto-accept UFG diffs from infra updates | AD-9583 ([#3797](https://github.com/Applitools-Dev/sdk/issues/3797)) ([fde553c](https://github.com/Applitools-Dev/sdk/commit/fde553c947aa3c040660ef5d07855fa4a1412399))

## [0.5.6](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.5...js/mcp@0.5.6) (2026-05-26)


### Bug Fixes

* strip .d.ts extension from import() type specifiers | FLD-4429 ([#3830](https://github.com/Applitools-Dev/sdk/issues/3830)) ([37aac45](https://github.com/Applitools-Dev/sdk/commit/37aac45958b713702bea87c144623dd3e65fce79))


### Dependencies

* @applitools/utils bumped to 1.14.5
  #### Bug Fixes

  * strip .d.ts extension from import() type specifiers | FLD-4429 ([#3830](https://github.com/Applitools-Dev/sdk/issues/3830)) ([37aac45](https://github.com/Applitools-Dev/sdk/commit/37aac45958b713702bea87c144623dd3e65fce79))
* @applitools/logger bumped to 2.2.12
  #### Bug Fixes

  * strip .d.ts extension from import() type specifiers | FLD-4429 ([#3830](https://github.com/Applitools-Dev/sdk/issues/3830)) ([37aac45](https://github.com/Applitools-Dev/sdk/commit/37aac45958b713702bea87c144623dd3e65fce79))



* @applitools/req bumped to 1.10.2
  #### Bug Fixes

  * strip .d.ts extension from import() type specifiers | FLD-4429 ([#3830](https://github.com/Applitools-Dev/sdk/issues/3830)) ([37aac45](https://github.com/Applitools-Dev/sdk/commit/37aac45958b713702bea87c144623dd3e65fce79))



* @applitools/image bumped to 1.2.11
  #### Bug Fixes

  * strip .d.ts extension from import() type specifiers | FLD-4429 ([#3830](https://github.com/Applitools-Dev/sdk/issues/3830)) ([37aac45](https://github.com/Applitools-Dev/sdk/commit/37aac45958b713702bea87c144623dd3e65fce79))



* @applitools/core-base bumped to 1.34.1
  #### Bug Fixes

  * strip .d.ts extension from import() type specifiers | FLD-4429 ([#3830](https://github.com/Applitools-Dev/sdk/issues/3830)) ([37aac45](https://github.com/Applitools-Dev/sdk/commit/37aac45958b713702bea87c144623dd3e65fce79))



* @applitools/test-server bumped to 1.4.4


## [0.5.5](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.4...js/mcp@0.5.5) (2026-05-19)


### Dependencies

* @applitools/req bumped to 1.10.1
  #### Bug Fixes

  * http2 support via settings AD 13119 ([#3804](https://github.com/Applitools-Dev/sdk/issues/3804)) ([759d451](https://github.com/Applitools-Dev/sdk/commit/759d4518254828140aa50e2c5de14e80af0b997c))
* @applitools/core-base bumped to 1.34.0
  #### Features

  * soft-deprecate CheckSettings.timeout() with telemetry [[#3705](https://github.com/Applitools-Dev/sdk/issues/3705)] ([#3805](https://github.com/Applitools-Dev/sdk/issues/3805)) ([a5d6390](https://github.com/Applitools-Dev/sdk/commit/a5d6390f17fc0380736b88cbe05dd147e66a86cf))


  #### Bug Fixes

  * http2 support via settings AD 13119 ([#3804](https://github.com/Applitools-Dev/sdk/issues/3804)) ([759d451](https://github.com/Applitools-Dev/sdk/commit/759d4518254828140aa50e2c5de14e80af0b997c))




## [0.5.4](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.3...js/mcp@0.5.4) (2026-05-05)


### Bug Fixes

* re-trigger release for dom-snapshot (FLD-4452) and mcp (AD-13206) ([#3800](https://github.com/Applitools-Dev/sdk/issues/3800)) ([105dd42](https://github.com/Applitools-Dev/sdk/commit/105dd42010a56c454752eaca69380aaba085073e))

## [0.5.3](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.2...js/mcp@0.5.3) (2026-04-23)


### Dependencies

* @applitools/req bumped to 1.10.0
  #### Features

  * expose httpVersion as SDK configuration flag | AD-13119 ([#3731](https://github.com/Applitools-Dev/sdk/issues/3731)) ([efee143](https://github.com/Applitools-Dev/sdk/commit/efee143729ee9ee31b669ea714c69a0ab57bbb1e))
* @applitools/core-base bumped to 1.33.0
  #### Features

  * expose httpVersion as SDK configuration flag | AD-13119 ([#3731](https://github.com/Applitools-Dev/sdk/issues/3731)) ([efee143](https://github.com/Applitools-Dev/sdk/commit/efee143729ee9ee31b669ea714c69a0ab57bbb1e))




## [0.5.2](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.1...js/mcp@0.5.2) (2026-04-16)


### Bug Fixes

* remediate npm security vulnerabilities (FLD-4179) ([#3764](https://github.com/Applitools-Dev/sdk/issues/3764)) ([4bc0ef9](https://github.com/Applitools-Dev/sdk/commit/4bc0ef915e8ad606627c6074de582bec53397738))


### Dependencies

* @applitools/utils bumped to 1.14.4
  #### Bug Fixes

  * remediate npm security vulnerabilities (FLD-4179) ([#3764](https://github.com/Applitools-Dev/sdk/issues/3764)) ([4bc0ef9](https://github.com/Applitools-Dev/sdk/commit/4bc0ef915e8ad606627c6074de582bec53397738))
* @applitools/logger bumped to 2.2.11
  #### Bug Fixes

  * remediate npm security vulnerabilities (FLD-4179) ([#3764](https://github.com/Applitools-Dev/sdk/issues/3764)) ([4bc0ef9](https://github.com/Applitools-Dev/sdk/commit/4bc0ef915e8ad606627c6074de582bec53397738))



* @applitools/req bumped to 1.9.3
  #### Bug Fixes

  * remediate npm security vulnerabilities (FLD-4179) ([#3764](https://github.com/Applitools-Dev/sdk/issues/3764)) ([4bc0ef9](https://github.com/Applitools-Dev/sdk/commit/4bc0ef915e8ad606627c6074de582bec53397738))



* @applitools/image bumped to 1.2.10
  #### Bug Fixes

  * remediate npm security vulnerabilities (FLD-4179) ([#3764](https://github.com/Applitools-Dev/sdk/issues/3764)) ([4bc0ef9](https://github.com/Applitools-Dev/sdk/commit/4bc0ef915e8ad606627c6074de582bec53397738))



* @applitools/core-base bumped to 1.32.5
  #### Bug Fixes

  * remediate npm security vulnerabilities (FLD-4179) ([#3764](https://github.com/Applitools-Dev/sdk/issues/3764)) ([4bc0ef9](https://github.com/Applitools-Dev/sdk/commit/4bc0ef915e8ad606627c6074de582bec53397738))



* @applitools/test-server bumped to 1.4.3


## [0.5.1](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.5.0...js/mcp@0.5.1) (2026-03-29)


### Bug Fixes

* exclude CHANGELOG.md from all published npm packages | AD-10793 ([#3682](https://github.com/Applitools-Dev/sdk/issues/3682)) ([95a0a80](https://github.com/Applitools-Dev/sdk/commit/95a0a8063fc2e1809c1bef1fc651d6deceda6e7e))
* update mcp bundling to address vulnerability concerns | AD-13065 ([#3685](https://github.com/Applitools-Dev/sdk/issues/3685)) ([afbda86](https://github.com/Applitools-Dev/sdk/commit/afbda860fd0fb8ce2d1e30cdc3b9a5e502c33ad7))


### Dependencies

* @applitools/utils bumped to 1.14.3
  #### Bug Fixes

  * exclude CHANGELOG.md from all published npm packages | AD-10793 ([#3682](https://github.com/Applitools-Dev/sdk/issues/3682)) ([95a0a80](https://github.com/Applitools-Dev/sdk/commit/95a0a8063fc2e1809c1bef1fc651d6deceda6e7e))
* @applitools/logger bumped to 2.2.10
  #### Bug Fixes

  * exclude CHANGELOG.md from all published npm packages | AD-10793 ([#3682](https://github.com/Applitools-Dev/sdk/issues/3682)) ([95a0a80](https://github.com/Applitools-Dev/sdk/commit/95a0a8063fc2e1809c1bef1fc651d6deceda6e7e))



* @applitools/req bumped to 1.9.2
  #### Bug Fixes

  * exclude CHANGELOG.md from all published npm packages | AD-10793 ([#3682](https://github.com/Applitools-Dev/sdk/issues/3682)) ([95a0a80](https://github.com/Applitools-Dev/sdk/commit/95a0a8063fc2e1809c1bef1fc651d6deceda6e7e))



* @applitools/image bumped to 1.2.9
  #### Bug Fixes

  * exclude CHANGELOG.md from all published npm packages | AD-10793 ([#3682](https://github.com/Applitools-Dev/sdk/issues/3682)) ([95a0a80](https://github.com/Applitools-Dev/sdk/commit/95a0a8063fc2e1809c1bef1fc651d6deceda6e7e))



* @applitools/core-base bumped to 1.32.4
  #### Bug Fixes

  * exclude CHANGELOG.md from all published npm packages | AD-10793 ([#3682](https://github.com/Applitools-Dev/sdk/issues/3682)) ([95a0a80](https://github.com/Applitools-Dev/sdk/commit/95a0a8063fc2e1809c1bef1fc651d6deceda6e7e))



* @applitools/test-server bumped to 1.4.2
  #### Bug Fixes

  * exclude CHANGELOG.md from all published npm packages | AD-10793 ([#3682](https://github.com/Applitools-Dev/sdk/issues/3682)) ([95a0a80](https://github.com/Applitools-Dev/sdk/commit/95a0a8063fc2e1809c1bef1fc651d6deceda6e7e))




## [0.5.0](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.4.3...js/mcp@0.5.0) (2026-03-16)


### Features

* improve playwright reporter instructions and stale verifications | AD-13006 ([#3667](https://github.com/Applitools-Dev/sdk/issues/3667)) ([57cc595](https://github.com/Applitools-Dev/sdk/commit/57cc5953c4ac12d5b92ed6888f1007177924e1ae))


### Bug Fixes

* update mcp readme instructions ([#3663](https://github.com/Applitools-Dev/sdk/issues/3663)) ([065d433](https://github.com/Applitools-Dev/sdk/commit/065d4333eddf36a26907e66339f7506db0bd5f59))


### Dependencies

* @applitools/core-base bumped to 1.32.3
  #### Bug Fixes

  * pass gzip content encoding | FLD-4293 ([#3649](https://github.com/Applitools-Dev/sdk/issues/3649)) ([b78ebaa](https://github.com/Applitools-Dev/sdk/commit/b78ebaa0bb0d9aeae0d5b7031d320ca10b5f608b))

## [0.4.3](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.4.2...js/mcp@0.4.3) (2026-03-12)


### Dependencies

* @applitools/core-base bumped to 1.32.2
  #### Bug Fixes

  * logEventBatch leaks to console | FLD-4175 ([#3608](https://github.com/Applitools-Dev/sdk/issues/3608)) ([f749d28](https://github.com/Applitools-Dev/sdk/commit/f749d287bf8a8e91ab819c04b13f8246f3d3a244))

## [0.4.2](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.4.1...js/mcp@0.4.2) (2026-03-10)


### Bug Fixes

* req not found in dist/index file ([#3625](https://github.com/Applitools-Dev/sdk/issues/3625)) ([9c7d391](https://github.com/Applitools-Dev/sdk/commit/9c7d3917656690db2186ce6685cefa8fed9fe6bc))

## [0.4.1](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.4.0...js/mcp@0.4.1) (2026-03-08)


### Bug Fixes

* unskip js/mcp ([#3618](https://github.com/Applitools-Dev/sdk/issues/3618)) ([103f9e2](https://github.com/Applitools-Dev/sdk/commit/103f9e2f18cddc225aba2f2f59556e5fa38965c0))


### Dependencies

* @applitools/utils bumped to 1.14.2
  #### Bug Fixes

  * unskip js/mcp ([#3618](https://github.com/Applitools-Dev/sdk/issues/3618)) ([103f9e2](https://github.com/Applitools-Dev/sdk/commit/103f9e2f18cddc225aba2f2f59556e5fa38965c0))
* @applitools/logger bumped to 2.2.9
  #### Bug Fixes

  * unskip js/mcp ([#3618](https://github.com/Applitools-Dev/sdk/issues/3618)) ([103f9e2](https://github.com/Applitools-Dev/sdk/commit/103f9e2f18cddc225aba2f2f59556e5fa38965c0))



* @applitools/req bumped to 1.9.1
  #### Bug Fixes

  * unskip js/mcp ([#3618](https://github.com/Applitools-Dev/sdk/issues/3618)) ([103f9e2](https://github.com/Applitools-Dev/sdk/commit/103f9e2f18cddc225aba2f2f59556e5fa38965c0))



* @applitools/image bumped to 1.2.8
  #### Bug Fixes

  * unskip js/mcp ([#3618](https://github.com/Applitools-Dev/sdk/issues/3618)) ([103f9e2](https://github.com/Applitools-Dev/sdk/commit/103f9e2f18cddc225aba2f2f59556e5fa38965c0))



* @applitools/core-base bumped to 1.32.1
  #### Bug Fixes

  * unskip js/mcp ([#3618](https://github.com/Applitools-Dev/sdk/issues/3618)) ([103f9e2](https://github.com/Applitools-Dev/sdk/commit/103f9e2f18cddc225aba2f2f59556e5fa38965c0))



* @applitools/test-server bumped to 1.4.1
  #### Bug Fixes

  * unskip js/mcp ([#3618](https://github.com/Applitools-Dev/sdk/issues/3618)) ([103f9e2](https://github.com/Applitools-Dev/sdk/commit/103f9e2f18cddc225aba2f2f59556e5fa38965c0))




## [0.4.0](https://github.com/Applitools-Dev/sdk/compare/js/mcp@0.3.0...js/mcp@0.4.0) (2026-03-08)


### Features

* mcp improved naming conventions | AD-12875 ([#3611](https://github.com/Applitools-Dev/sdk/issues/3611)) ([6f1020e](https://github.com/Applitools-Dev/sdk/commit/6f1020e08015d74c108780ca63716ffda36a7472))
* release java ([7bc39e6](https://github.com/Applitools-Dev/sdk/commit/7bc39e679eab27a19322ca4b121177da7437c106))

## [0.3.0](https://github.com/Applitools-Dev/sdk/compare/js/eyes-mcp@0.2.1...js/eyes-mcp@0.3.0) (2026-03-02)


### Features

* http 2 support | FLD-4085 ([#3539](https://github.com/Applitools-Dev/sdk/issues/3539)) ([b304d4a](https://github.com/Applitools-Dev/sdk/commit/b304d4a1072a201d1c3f5cea1275b6a15230d6aa))


### Dependencies

* @applitools/req bumped to 1.9.0
  #### Features

  * http 2 support | FLD-4085 ([#3539](https://github.com/Applitools-Dev/sdk/issues/3539)) ([b304d4a](https://github.com/Applitools-Dev/sdk/commit/b304d4a1072a201d1c3f5cea1275b6a15230d6aa))
* @applitools/core-base bumped to 1.32.0
  #### Features

  * http 2 support | FLD-4085 ([#3539](https://github.com/Applitools-Dev/sdk/issues/3539)) ([b304d4a](https://github.com/Applitools-Dev/sdk/commit/b304d4a1072a201d1c3f5cea1275b6a15230d6aa))


  #### Bug Fixes

  * video link with http live streaming - workaround | FLD-4089 ([#3567](https://github.com/Applitools-Dev/sdk/issues/3567)) ([8639c37](https://github.com/Applitools-Dev/sdk/commit/8639c37d39997915d5fcdc46c45a96d510b6ad91))




## [0.2.1](https://github.com/Applitools-Dev/sdk/compare/js/eyes-mcp@0.2.0...js/eyes-mcp@0.2.1) (2026-03-01)


### Performance Improvements

* use sharp to accelerate png performance in all js packages ([#3547](https://github.com/Applitools-Dev/sdk/issues/3547)) ([6e3c7b9](https://github.com/Applitools-Dev/sdk/commit/6e3c7b9e34815f470032ece52a161001592ad1b1))


### Dependencies

* @applitools/image bumped to 1.2.7
  #### Performance Improvements

  * use sharp to accelerate png performance in all js packages ([#3547](https://github.com/Applitools-Dev/sdk/issues/3547)) ([6e3c7b9](https://github.com/Applitools-Dev/sdk/commit/6e3c7b9e34815f470032ece52a161001592ad1b1))
* @applitools/core-base bumped to 1.31.3
  #### Performance Improvements

  * use sharp to accelerate png performance in all js packages ([#3547](https://github.com/Applitools-Dev/sdk/issues/3547)) ([6e3c7b9](https://github.com/Applitools-Dev/sdk/commit/6e3c7b9e34815f470032ece52a161001592ad1b1))




## [0.2.0](https://github.com/Applitools-Dev/sdk/compare/js/eyes-mcp@0.1.0...js/eyes-mcp@0.2.0) (2026-02-16)


### Features

* mcp server test results support and improvements to initial setup ([#3518](https://github.com/Applitools-Dev/sdk/issues/3518)) ([ef6c27b](https://github.com/Applitools-Dev/sdk/commit/ef6c27b9e35dc54fd588e19a4811631433e15dbb))


### Dependencies

* @applitools/logger bumped to 2.2.8
  #### Bug Fixes

  * use utils for environment variable retrieval in logger handlers ([#3551](https://github.com/Applitools-Dev/sdk/issues/3551)) ([caf97f3](https://github.com/Applitools-Dev/sdk/commit/caf97f34207bc3b8ee6ccda2855c27a99a262f8c))


  #### Performance Improvements

  * add timing logs to classic | FLD-4137 ([#3543](https://github.com/Applitools-Dev/sdk/issues/3543)) ([de2b0aa](https://github.com/Applitools-Dev/sdk/commit/de2b0aaf08d813f2c59e9552947c2f4fbc12da48))
* @applitools/req bumped to 1.8.8

* @applitools/test-server bumped to 1.4.0
  #### Features

  * make eyes-browser truly browser-importable ([#3512](https://github.com/Applitools-Dev/sdk/issues/3512)) ([9574a2f](https://github.com/Applitools-Dev/sdk/commit/9574a2fa45ec80466dfe93744c8a736f40fb51c3))
  * mcp server test results support and improvements to initial setup ([#3518](https://github.com/Applitools-Dev/sdk/issues/3518)) ([ef6c27b](https://github.com/Applitools-Dev/sdk/commit/ef6c27b9e35dc54fd588e19a4811631433e15dbb))



* @applitools/core-base bumped to 1.31.2


## [0.1.0](https://github.com/Applitools-Dev/sdk/compare/js/eyes-mcp-server-v0.0.1...js/eyes-mcp-server@0.1.0) (2026-01-28)


### Features

* release java ([7bc39e6](https://github.com/Applitools-Dev/sdk/commit/7bc39e679eab27a19322ca4b121177da7437c106))

## [Unreleased]

### Changed
- **BREAKING**: Recommended server name changed from `"applitools-eyes"` to `"eyes"` for shorter tool names
  - Tool names now appear as `mcp__eyes__info` instead of `mcp__applitools-eyes__info`
  - Old server name still works for backward compatibility
- Reorganized tools directory structure for better code separation
  - Each tool now resides in its own subdirectory under `src/tools/`
  - Updated import paths to reflect new structure

### Added
- VS Code Extension support for automatic MCP server registration
  - Auto-registers with VS Code, Cline, and Claude Code
  - Auto-cleanup on extension uninstall
- Claude Code integration in VS Code Extension
- Comprehensive documentation in `src/tools/README.md` for tool development
- Project structure section in main README
- Development and Contributing sections in main README

### Fixed
- Import paths updated to work with new directory structure

## [1.0.0] - 2025-01-04

### Added
- Initial release of Applitools Eyes MCP
- `info` tool for server capabilities information
- `version` tool for version information display
- Support for stdio and SSE (HTTP) transports
- Dual-mode server operation (stdio by default, SSE with --port flag)
- Clear attribution and branding for all tool responses
- Comprehensive error handling
- Zero-configuration setup via npx

### Documentation
- Complete README with installation instructions
- Configuration examples for Cursor, VS Code, Cline, and Claude Code
- Usage examples and prompts

[Unreleased]: https://github.com/applitools/eyes.sdk.javascript/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/applitools/eyes.sdk.javascript/releases/tag/v1.0.0
