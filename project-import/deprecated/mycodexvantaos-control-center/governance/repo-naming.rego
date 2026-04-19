package codexvanta.naming

default deny = []

valid_prefix(name) {
  startswith(name, "codexvanta-os-")
}

invalid_token(name) {
  contains(name, "_")
} {
  contains(name, ".")
} {
  contains(name, " ")
} {
  contains(name, "--")
}

invalid_suffix(name) {
  endswith(name, "-dev")
} {
  endswith(name, "-prod")
} {
  endswith(name, "-staging")
} {
  endswith(name, "-test")
}

deny contains msg if {
  repo := input.repos[_]
  name := repo.name
  not valid_prefix(name)
  msg := sprintf("repo '%s' must start with codexvanta-os-", [name])
}

deny contains msg if {
  repo := input.repos[_]
  name := repo.name
  invalid_token(name)
  msg := sprintf("repo '%s' contains forbidden token", [name])
}

deny contains msg if {
  repo := input.repos[_]
  name := repo.name
  invalid_suffix(name)
  msg := sprintf("repo '%s' contains forbidden suffix", [name])
}