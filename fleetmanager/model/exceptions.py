class NoCarsSelected(Exception):
    # thrown in goal simulation when all cars are release and only bikes are selected
    self_defined = True
    pass


class NoSolutionFound(Exception):
    # thrown when no solutions found in Tabu search
    self_defined = True
    pass


class MetadataColumnError(Exception):
    # thrown when the uploaded metadata sheet does not hold the expected columns
    self_defined = True

    def __init__(self, missing_columns=None, unexpected_columns=None):
        self.missing_columns = sorted(missing_columns or [])
        self.unexpected_columns = sorted(unexpected_columns or [])
        super().__init__(
            f"missing columns: {self.missing_columns}, "
            f"unexpected columns: {self.unexpected_columns}"
        )


class MetadataRowInvalidError(Exception):
    self_defined = True


class MetadataFileError(Exception):
    # thrown when the uploaded metadata file could not be parsed as a spreadsheet
    self_defined = True

    def __init__(self, reason=None):
        self.reason = reason
        super().__init__(reason or "unreadable file")
