# Contribution guidelines for *OS2FleetOptimiser*

If you want to contribute to *OS2FleetOptimiser*, we ask you to follow these guidelines.

## Reporting bugs
If you have encountered a bug in *OS2FleetOptimiser*, please check if an issue already exists in the list of existing [issues](https://github.com/OS2fleetoptimiser/OS2fleetoptimiser/issues), if such an issue does not exist, you can create one [here](https://github.com/OS2fleetoptimiser/OS2fleetoptimiser/issues). When writing the bug report, try to add a clear example that shows how to reproduce said bug.

## Adding new features
Before making changes to the code, we advise you to first check the list of existing [issues](https://github.com/OS2fleetoptimiser/OS2fleetoptimiser/issues) for OS2FleetOptimiser to see if an issue for the suggested changes already exists. If such an issue does not exist, you can create one [here](https://github.com/OS2fleetoptimiser/OS2fleetoptimiser/issues). Creating an issue gives an opportunity for other developers to give tips even before you start coding. If you are in the early idea phase, or if your feature requires larger changes, you can discuss it with the [projects coordination group](https://os2.eu) or by [contacting OS2 directly](https://os2.eu/kontakt) to make sure you are heading in the right direction.

### Code style
There is no enforced coding style at this time.  
  
### Forking the repository
In order to implement changes to *OS2FleetOptimiser* when you do not have rights for the required repository, you must first fork the repository. Once the repository is forked, you can clone it to your local machine.

### Making the changes
On your local machine, create a new branch, and name it like:
- `feature/some-new-feature`, if the changes implement a new feature
- `bug/some-issue`, if the changes fix an issue

Once you have made changes or additions to the code, you can commit them (try to keep the commit message descriptive but short). If an issue exists in the issue list for the changes you made, be sure to format your commit message like `"Fixes #<issue_id> -- description of changes made`, where `<issue_id>"` corresponds to the number of the issue on Jira or GitHub. To demonstrate that the changes implement the new feature/fix the issue, make sure to also add tests.

### Making a pull request
If all changes have been committed, you can push the branch to your fork of the repository and create a pull request to the `master` branch of the *OS2FleetOptimiser* repository. Your pull request will be reviewed, if applicable feedback will be given and if everything is approved, it will be merged.

### Reviews on releases

All pull requests will be reviewed before they are merged to a release branch. As well as being reviewed for functionality and following the code style they will be checked with the steering committee and/or the coordination group for the project.
