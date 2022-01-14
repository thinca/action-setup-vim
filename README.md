# setup-vim

[![Test][test-ci-badge]][test-ci-action]
[![Lint][lint-ci-badge]][lint-ci-action]

`setup-vim` is a GitHub Action to setup [Vim][vim], [Neovim][neovim], or [MacVim][macvim].


## Usage

Basic:

```yaml
# Setup the head version of Vim
- uses: thinca/action-setup-vim@v1
```

With options:

```yaml
- uses: thinca/action-setup-vim@v1
  with:
    vim_version: v8.2.0000
```

Setup Vim and Neovim with 2 versions for each platforms using matrix:

```yaml
strategy:
  matrix:
    vim_type: ['Vim', 'Neovim']
    version: ['head', 'stable']
    os: ['ubuntu-latest', 'macos-latest', 'windows-latest']
    include:
      - vim_type: 'Vim'
        version: 'stable'
        vim_version: 'v8.2.0000'
runs-on: '${{ matrix.os }}'
steps:
  - uses: 'actions/checkout@v2'
  - name: 'Setup Vim'
    id: 'vim'
    uses: 'thinca/action-setup-vim@v1'
    with:
      vim_version: '${{ matrix.vim_version || matrix.version }}'
      vim_type: '${{ matrix.vim_type }}'
  - name: 'Run test'
    run: |
      # Show Vim's version
      ${{ steps.vim.outputs.executable }} --version
      # ... run tests ...
```


### About installation

This action provides two ways to setup Vim.

1.  Build Vim from source code.
    You can specify Git's ref(tag, branch, or sha1) for [`vim_version`](#vim_version).
    The result is cached by default.  See [`cache`](#cache) input.

2.  Download pre-built Vim from releases page.
    You can specify semver(v8.2.0123, v0.4.3) or tag name of GitHub Release for [`vim_version`](#vim_version).

Some combinations not available.  See the following.
By default, uses `download` if available, otherwise uses `build`.


#### Vim

| OS      | way        | GUI    | Installation                                                       |
| ------- | ---------- | ------ | ------------------------------------------------------------------ |
| Linux   | `build`    | `gvim` | Sources from [vim/vim][vim].                                       |
| Linux   | `download` | `gvim` | Releases from [vim/vim-appimage][appimage-releases]. (*)           |
| MacOS   | `build`    | `gvim` | Sources from [vim/vim][vim].                                       |
| MacOS   | `download` | N/A    | Not available.                                                     |
| Windows | `build`    | `gvim` | Sources from [vim/vim][vim].                                       |
| Windows | `download` | `gvim` | Releases from [vim/vim-win32-installer][win32-installer-releases]. |

(*) Downloading Vim from AppImage is available from v8.1.1239.  Before v8.1.1234 cannot start vim.  This was fixed by [vim/vim-appimage#6](https://github.com/vim/vim-appimage/pull/6).


#### Neovim

| OS      | way        | GUI           | Installation                                    |
| ------- | ---------- | ------------- | ----------------------------------------------- |
| Linux   | `build`    | N/A           | Sources from [neovim/neovim][neovim].           |
| Linux   | `download` | N/A           | Releases from [neovim/neovim][neovim-releases]. |
| MacOS   | `build`    | N/A           | Sources from [neovim/neovim][neovim]. (**)      |
| MacOS   | `download` | N/A           | Releases from [neovim/neovim][neovim-releases]. |
| Windows | `build`    | N/A           | Not available(Help wanted).                     |
| Windows | `download` | `nvim-qt.exe` | Releases from [neovim/neovim][neovim-releases]. |

(**) Building Neovim on MacOS(Catalina) has a problem.

Building v0.4.3 and before versions will be failure.
See [neovim/neovim#11412](https://github.com/neovim/neovim/pull/11412) for the detail.


#### MacVim

| OS      | way        | GUI | Installation                                        |
| ------- | ---------- | --- | --------------------------------------------------- |
| Linux   | `build`    | N/A | Not available.                                      |
| Linux   | `download` | N/A | Not available.                                      |
| MacOS   | `build`    | N/A | Sources from [macvim-dev/macvim][macvim].           |
| MacOS   | `download` | N/A | Releases from [macvim-dev/macvim][macvim-releases]. |
| Windows | `build`    | N/A | Not available.                                      |
| Windows | `download` | N/A | Not available.                                      |

MacVim has a GUI version, but it is not supported yet because it is too difficult treating on CI.

Building snapshot-157 and before versions will be failure.
See [macvim-dev/macvim#946](https://github.com/macvim-dev/macvim/issues/946) for the detail.


### Action Inputs

#### `vim_version`

Version of Vim.
The meaning of this value depends on `vim_type` and `download`.

The value `head` is always head version:
When `download` is on, this points head of release.
When `download` is off, this points master of repository.

When `download` is on and specified a semver such as `v8.2.0000`, this action finds a minimum version that is higher than a specified version.
For example, when there are some released versions: `v8.2.0052` `v8.2.0057` `v8.2.0065`
And when a specified version is `v8.2.0055`, `v8.2.0057` is actually selected.
Also, when a specified version is `v8.2.0060`, `v8.2.0065` is actually selected.

When `download` is off, this is a tag of repository.
Note that the repository of MacVim has tags like `snapshot-xxx` instead of like `vx.x.xxx`.

default: `head`


#### `vim_type`

Type of Vim.
This is one of `vim`, `neovim`, or `macvim`.

default: `vim`


#### `gui`

When this is `yes`, setups the GUI version.
And `outputs.executable` points to GUI version of Vim.

default: `no`


#### `download`

When this is `always`, downloads the officially released binary, or fail if unavailable.
When this is `available`, downloads the officially released binary if available, otherwise builds from source code.
When this is `never`, always builds from source code.

default: `available`


#### `cache`

When this is `true`(default), cache the built Vim.

This uses same caching mechanism from [actions/cache][actions/cache].
Therefore, this consumes the limitation of cache size.

Ref: [Caching dependencies to speed up workflows#Usage limits and eviction policy][caching-policy]

This is automatically disabled when `download` is on.

default: `true`


#### `github_token`

Your GitHub API token to access to releases of repositories without limit.
Normally this is automatically set so you do not need set this.

default: `${{ github.token }}`


### Action Outputs

#### `executable`

The name of executable file.
This is not a full path, just name.
When `gui` is yes, this points to GUI version.
e.g. `vim` `nvim` `gvim`


#### `executable_path`

The full path of executable file.


#### `actual_vim_version`

Version of Vim actually installed.
e.g. `v8.2.0123` `v0.4.3` `49cd750d6a72efc0571a89d7a874bbb01081227f`


#### `install_type`

Install was done with `build` or `download`.


#### `install_path`

Base path of installed Vim.
Note that this does not point to `bin`.


#### `cache_hit`

When `cache` is enabled and cache was found, this is `true`.  Otherwise this is `false`.


## License

[zlib License](LICENSE.txt)


## Author

thinca <thinca@gmail.com>


[test-ci-badge]: ./../../workflows/Test/badge.svg
[test-ci-action]: ./../../actions?query=workflow%3ATest
[lint-ci-badge]: ./../../workflows/Lint/badge.svg
[lint-ci-action]: ./../../actions?query=workflow%3ALint
[vim]: https://github.com/vim/vim
[neovim]: https://github.com/neovim/neovim
[macvim]: https://github.com/macvim-dev/macvim
[appimage-releases]: https://github.com/vim/vim-appimage/releases
[win32-installer-releases]: https://github.com/vim/vim-win32-installer/releases
[neovim-releases]: https://github.com/neovim/neovim/releases
[macvim-releases]: https://github.com/macvim-dev/macvim/releases
[actions/cache]: https://github.com/actions/cache
[caching-policy]: https://help.github.com/en/actions/automating-your-workflow-with-github-actions/caching-dependencies-to-speed-up-workflows#usage-limits-and-eviction-policy
