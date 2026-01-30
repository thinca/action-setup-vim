# CHANGELOG

## v3.0.1 - 2026-01-31

- Security: Update dependencies.


## v3.0.0 - 2025-09-21

- Breaking Change: Update Node 20 to Node 24 the actions.
- Fixed: Older Neovim builds fail.
- Security: Update dependencies.


## v2.1.2 - 2025-03-03

- Fixed: Downloading latest Neovim.
- Security: Update dependencies.
  - Update all dependencies by resetting the lock file.
    - This Action was previously failing when using a cache, but this has been fixed in this update.


## v2.1.1 - 2025-01-06

- Fixed: Add support for downloading Vim on Ubuntu 24.04.
- Fixed: Add a patch for building old Neovim on MacOS 15.


## v2.1.0 - 2024-12-11

- Fixed: Remove unnecessary packages in MacOS Neovim build installer.
- Fixed: Fix some problems with latest GitHub-hosted runners.
  - Add patches for older Vim in Windows and MacOS.
- Security: Update dependencies.


## v2.0.3 - 2024-06-26

- Security: Update dependencies.


## v2.0.2 - 2024-04-25

- Security: Update dependencies.


## v2.0.1 - 2024-03-29

- Fixed: Downloading Neovim in Mac.  (Thanks [@mityu](https://github.com/mityu) [#14](https://github.com/thinca/action-setup-vim/pull/14))
- Security: Update dependencies.


## v2.0.0 - 2024-03-02

- Breaking Change: Update Node 16 to Node 20 the actions.
- Security: Update dependencies.


## v1.2.11 - 2023-08-01

- Security: Update dependencies.


## v1.2.10 - 2023-05-02

- Security: Update dependencies.


## v1.2.9 - 2023-01-12

- Security: Update dependencies.


## v1.2.8 - 2022-12-28

- Fixed: AppImage did not work on Ubuntu 22.04.


## v1.2.7 - 2022-11-24

- Security: Update dependencies.


## v1.2.6 - 2022-10-17

- Security: Update dependencies.


## v1.2.5 - 2022-08-26

- Security: Update dependencies.


## v1.2.4 - 2022-08-07

- Fixed: Caching of GitHub Releases did not work probability.


## v1.2.3 - 2022-07-28

- Security: Update dependencies.
- Fixed: Use correct version in built Neovim.


## v1.2.2 - 2022-06-03

- Security: Update dependencies.


## v1.2.1 - 2022-02-27

- Fixed: Fetching the head binary of Neovim.
- Security: Update dependencies.


## v1.2.0 - 2022-02-15

- Improved: Add `arch` argument MS-Windows.  (Thanks [@ichizok](https://github.com/ichizok) [#9](https://github.com/thinca/action-setup-vim/pull/9))
- Improved: Use the correct path of Visual Studio is MS-Windows.  (Thanks [@ichizok](https://github.com/ichizok) [#8](https://github.com/thinca/action-setup-vim/pull/8))
- Fixed: Wrong using of `LC_TYPE` in MacOS.  (Thanks [@ichizok](https://github.com/ichizok) [#7](https://github.com/thinca/action-setup-vim/pull/7))


## v1.1.2 - 2022-01-17

- Improved: Reduce consuming API rate limit.  (Thanks [@ichizok](https://github.com/ichizok) [#6](https://github.com/thinca/action-setup-vim/pull/6))
- Fixed: Cannot update the cache of GitHub Releases.  (Thanks [@ichizok](https://github.com/ichizok) [#6](https://github.com/thinca/action-setup-vim/pull/6))
- Security: Update dependencies.


## v1.1.1 - 2022-01-14

- Fixed: Building Vim on Linux with GUI.
- Fixed: Building MacVim.  (Thanks [@ichizok](https://github.com/ichizok) [#5](https://github.com/thinca/action-setup-vim/pull/5))


## v1.1.0 - 2021-08-14

- Added: `executable_path` output.
- Improved: Allow installs multiple different Vim at one environment.
- Security: Update dependencies.


## v1.0.9 - 2021-08-01

- Security: Update dependencies.


## v1.0.8 - 2021-05-23

- Fixed: Building Neovim v0.4.4.
- Fixed: Building was selected when Neovim's version is `stable` and `download` is `available`.
- Fixed: Building MacVim.
- Security: Update dependencies.


## v1.0.7 - 2020-11-18

- Added: `install_path` output.
- Added: `cache_hit` output.
- Improved: Improve for old version of Neovim.
- Fixed: Caching problem when multiple jobs run.
- Security: Update dependencies.


## v1.0.6 - 2020-11-03

- Fixed: Follow to latest MacOS environment of GitHub Actions.


## v1.0.5 - 2020-09-25

- Security: Update dependencies.


## v1.0.4 - 2020-08-24

- Fixed: Setup fails sometimes.
- Security: Update dependencies.


## v1.0.3 - 2020-07-29

- Improved: Cache the GitHub Releases.
  - API call is reduced.
- Security: Update dependencies.


## v1.0.2 - 2020-06-07

- Fixed: Caching feature was always disabled.


## v1.0.1 - 2020-03-25

- Fixed: Do not select "download" on Linux with Vim v8.1.1238 or older when `download` is `available`.


## v1.0.0 - 2020-03-09

- First release.
