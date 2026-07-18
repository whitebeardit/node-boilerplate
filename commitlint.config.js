// Org standard: .cursor/rules/ai_knowledge_base/code-versioning/commits/COMMITLINT_CONFIG.md
// body/footer line length checks are disabled to allow long URLs in footers.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'chore',
        'build',
        'ci',
        'release',
        'security',
        'revert',
      ],
    ],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [0, 'always', 72],
    'footer-leading-blank': [2, 'always'],
    'footer-max-line-length': [0, 'always', 72],
    'header-max-length': [2, 'always', 72],
  },
};
