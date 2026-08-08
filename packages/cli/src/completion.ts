export type CompletionShell = "bash" | "zsh" | "fish";

const commands = ["init", "lint", "build", "watch", "inspect", "completion", "help", "version"];
const commonOptions = ["--config", "--release-profile", "--format", "--help"];

function bashCompletion(): string {
	return `# bash completion for s11tnext
_s11tnext_completion() {
  local current previous command
  COMPREPLY=()
  current="\${COMP_WORDS[COMP_CWORD]}"
  previous="\${COMP_WORDS[COMP_CWORD-1]}"
  command="\${COMP_WORDS[1]}"

  if [[ "\${previous}" == "completion" ]]; then
    COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${current}") )
    return
  fi
  if [[ "\${COMP_CWORD}" -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${commands.join(" ")} --help --version" -- "\${current}") )
    return
  fi

  case "\${command}" in
    init) COMPREPLY=( $(compgen -W "--template --locale --keyspace --owner --release-profile --no-editor --dry-run --format --help" -- "\${current}") ) ;;
    lint) COMPREPLY=( $(compgen -W "${commonOptions.join(" ")}" -- "\${current}") ) ;;
    build) COMPREPLY=( $(compgen -W "${[...commonOptions, "--check"].join(" ")}" -- "\${current}") ) ;;
    watch) COMPREPLY=( $(compgen -W "${commonOptions.join(" ")}" -- "\${current}") ) ;;
    inspect) COMPREPLY=( $(compgen -W "${[
			...commonOptions,
			"--resolved",
			"--locale",
			"--coverage",
			"--fallback-locale",
		].join(" ")}" -- "\${current}") ) ;;
  esac
}
complete -F _s11tnext_completion s11tnext
`;
}

function zshCompletion(): string {
	return `#compdef s11tnext

_s11tnext() {
  local -a commands
  commands=(
    'init:create a starter project'
    'lint:validate authored contexts'
    'build:compile artifacts and generated types'
    'watch:rebuild when authored files change'
    'inspect:inspect one context or locale coverage'
    'completion:emit shell completion'
    'help:show command help'
    'version:show the CLI version'
  )

  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi

  case "\${words[2]}" in
    init)
      _arguments '--template[starter template]:(minimal production)' '--locale[source locale]:locale:' '--keyspace[keyspace]:keyspace:' '--owner[owner]:owner:' '--release-profile[release profile]:profile:' '--no-editor[skip Taplo schema setup]' '--dry-run[preview files]' '--format[output format]:(human json)' '--help[show help]'
      ;;
    lint)
      _arguments '--config[config path]:path:_files' '--release-profile[release profile]:profile:' '--format[output format]:(human json)' '--help[show help]'
      ;;
    build)
      _arguments '--config[config path]:path:_files' '--release-profile[release profile]:profile:' '--format[output format]:(human json)' '--check[check generated outputs]' '--help[show help]'
      ;;
    watch)
      _arguments '--config[config path]:path:_files' '--release-profile[release profile]:profile:' '--format[output format]:(human json)' '--help[show help]'
      ;;
    inspect)
      _arguments '1:context key:' '--config[config path]:path:_files' '--release-profile[release profile]:profile:' '--format[output format]:(human json)' '--resolved[show resolved policy]' '--locale[instruction locale]:locale:' '--coverage[show locale coverage]' '*--fallback-locale[fallback locale]:locale:' '--help[show help]'
      ;;
    completion)
      _arguments '1:shell:(bash zsh fish)'
      ;;
  esac
}

_s11tnext "$@"
`;
}

function fishCompletion(): string {
	return `# fish completion for s11tnext
complete -c s11tnext -f
complete -c s11tnext -n '__fish_use_subcommand' -a init -d 'Create a starter project'
complete -c s11tnext -n '__fish_use_subcommand' -a lint -d 'Validate authored contexts'
complete -c s11tnext -n '__fish_use_subcommand' -a build -d 'Compile artifacts and generated types'
complete -c s11tnext -n '__fish_use_subcommand' -a watch -d 'Rebuild when authored files change'
complete -c s11tnext -n '__fish_use_subcommand' -a inspect -d 'Inspect a context or locale coverage'
complete -c s11tnext -n '__fish_use_subcommand' -a completion -d 'Emit shell completion'
complete -c s11tnext -n '__fish_use_subcommand' -a help -d 'Show command help'
complete -c s11tnext -n '__fish_use_subcommand' -a version -d 'Show the CLI version'
complete -c s11tnext -l help -d 'Show help'
complete -c s11tnext -l version -d 'Show the CLI version'
complete -c s11tnext -n '__fish_seen_subcommand_from init' -l template -r -a 'minimal production' -d 'Starter template'
complete -c s11tnext -n '__fish_seen_subcommand_from init' -l locale -r -d 'Source locale'
complete -c s11tnext -n '__fish_seen_subcommand_from init' -l keyspace -r -d 'Keyspace'
complete -c s11tnext -n '__fish_seen_subcommand_from init' -l owner -r -d 'Owner'
complete -c s11tnext -n '__fish_seen_subcommand_from init' -l no-editor -d 'Skip Taplo schema setup'
complete -c s11tnext -n '__fish_seen_subcommand_from init' -l dry-run -d 'Preview files'
complete -c s11tnext -n '__fish_seen_subcommand_from lint build watch inspect' -l config -r -d 'Config path'
complete -c s11tnext -n '__fish_seen_subcommand_from init lint build watch inspect' -l release-profile -r -d 'Release profile'
complete -c s11tnext -n '__fish_seen_subcommand_from init lint build watch inspect' -l format -r -a 'human json' -d 'Output format'
complete -c s11tnext -n '__fish_seen_subcommand_from build' -l check -d 'Check generated outputs'
complete -c s11tnext -n '__fish_seen_subcommand_from inspect' -l resolved -d 'Show resolved policy'
complete -c s11tnext -n '__fish_seen_subcommand_from inspect' -l locale -r -d 'Instruction locale'
complete -c s11tnext -n '__fish_seen_subcommand_from inspect' -l coverage -d 'Show locale coverage'
complete -c s11tnext -n '__fish_seen_subcommand_from inspect' -l fallback-locale -r -d 'Fallback locale'
complete -c s11tnext -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish'
`;
}

export function completionScript(shell: CompletionShell): string {
	if (shell === "bash") return bashCompletion();
	if (shell === "zsh") return zshCompletion();
	return fishCompletion();
}
