import { CircularProgress, Button, Dialog, DialogContent, DialogTitle, DialogActions } from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import Done from '@mui/icons-material/Done';
import { isAxiosError, AxiosError } from 'axios';
import { useState, ChangeEvent } from 'react';
import AxiosBase from '@/components/AxiosBase';

interface ModalProps {
    onClose: () => void;
    open: boolean;
    refetch: () => void;
}

interface RowValidation {
    row: number;
    msg: string;
}

interface ValidationResultType {
    valid: RowValidation[];
    errors: RowValidation[];
    ignores: RowValidation[];
    total_updated: number;
}

interface ErrorDetail {
    error: string;
}

interface ErrorResponse {
    detail: ErrorDetail;
}

const ValidationResultList = ({ validationResult }: { validationResult: ValidationResultType | null }) => {
    if (validationResult == null) {
        return <div className="flex flex-col">Ingen resultater fra validering</div>;
    }

    if (validationResult.errors.length) {
        return (
            <div className="flex flex-col">
                Errors:
                {validationResult?.errors.map((err, index) => (
                    <div className="m-2 bg-red-300" key={index}>
                        Række {err.row}: {err.msg}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <div className="m-2 text-green-600">{validationResult?.valid.length} række(r) opdateres.</div>
            {validationResult?.ignores.map((item, index) => (
                <div className="ml-2 my-1 text-yellow-600" key={index}>
                    Række {item.row}: {item.msg}
                </div>
            ))}
        </div>
    );
};

type StatusTypes = 'upload' | 'validating' | 'errors' | 'changes' | 'updating' | 'done' | 'apierror';

const postMetadata = async (f: File | null, validationOnly: boolean) => {
    if (f == null) {
        throw new Error('File is not set');
    }

    const formData = new FormData();
    if (f) {
        formData.append('file', f);
    }

    const endpoint = '/configuration/vehicles/metadata';
    const url = validationOnly ? endpoint + '?validationonly=1' : endpoint;
    const response = await AxiosBase.post(url, formData);
    return response;
};

const mapErrors = (err: AxiosError) => {
    const errorData = err.response?.data as ErrorResponse | undefined;

    if (err.response?.status == 422 && errorData?.detail.error == 'invalid_columns') {
        return 'Fejl i en eller flere kolonneoverskrifter';
    }
    if (err.response?.status == 422 && errorData?.detail.error == 'invalid_rows') {
        return 'Fejl i en eller flere rækker';
    }
    if (err.response?.status == 415) {
        return 'Forkert filtype eller fejl i data-celle';
    }

    return 'Ukendt fejl';
};

export const ImportModal = ({ open, onClose, refetch }: ModalProps) => {
    const [validationResult, setValidationResult] = useState<ValidationResultType | null>(null);
    const [dataFile, setDataFile] = useState<File | null>(null);
    const [status, setStatus] = useState<StatusTypes>('upload');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const validateData = async (f: File) => {
        setStatus('validating');
        setDataFile(f);

        try {
            const res = await postMetadata(f, true);
            setValidationResult(res.data);
            setStatus(res.data.errors.length > 0 ? 'errors' : 'changes');
        } catch (err) {
            setStatus('apierror');

            if (isAxiosError(err)) {
                const msg = mapErrors(err);
                setErrorMsg(msg);
                return;
            }

            setErrorMsg('Ukendt fejl under validering');
        }
    };

    const updateData = async () => {
        setStatus('updating');
        try {
            const res = await postMetadata(dataFile, false);
            setValidationResult(res.data);
            setStatus('done');
        } catch (err) {
            setStatus('apierror');

            if (isAxiosError(err)) {
                const msg = mapErrors(err);
                setErrorMsg(msg);
                return;
            }

            setErrorMsg('Ukendt fejl under opdatering');
        }
    };

    const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target?.files) {
            const a = event.target?.files[0];
            await validateData(a);
        }
    };

    const handleOnClose = () => {
        // reset and close
        refetch();
        setDataFile(null);
        setValidationResult(null);
        setStatus('upload');
        onClose();
    };

    return (
        <>
            <Dialog open={open} fullWidth={true} maxWidth={'sm'} className="min-h-full">
                <DialogTitle className="mb-3" textAlign="center">
                    Importér flådedata
                </DialogTitle>
                <DialogContent>
                    <form>
                        {status == 'upload' && (
                            <div className="flex justify-center">
                                <Button component="label" role={undefined} variant="contained" tabIndex={-1} startIcon={<FileUploadIcon />}>
                                    Upload .xlsx
                                    <input type="file" accept={'.xlsx'} onChange={onFileChange} hidden={true} />
                                </Button>
                            </div>
                        )}

                        {status == 'validating' && (
                            <div className="flex flex-col justify-center">
                                <CircularProgress className="mx-auto w-12 h-12" />
                                <div className="mx-auto">Validerer data</div>
                            </div>
                        )}

                        {(status == 'errors' || status == 'changes') && <ValidationResultList validationResult={validationResult} />}

                        {status == 'updating' && (
                            <div className="flex flex-col justify-center">
                                <CircularProgress className="mx-auto w-12 h-12" />
                                <div className="mx-auto">Gemmer data</div>
                            </div>
                        )}

                        {status == 'done' && (
                            <div className="flex flex-col justify-center">
                                <Done className="mx-auto text-green-500 w-12 h-12" />
                                <div className="mx-auto">{validationResult?.total_updated} rækker er opdareret. Du kan nu lukke denne box.</div>
                            </div>
                        )}

                        {status == 'apierror' && (
                            <div className="flex flex-col justify-center">
                                <div className="mx-auto">{errorMsg}</div>
                            </div>
                        )}

                        <DialogActions className="flex gap-4 mt-8">
                            <Button className="" variant="outlined" onClick={handleOnClose} disabled={status == 'validating' || status == 'updating'}>
                                {status == 'done' || status == 'errors' || status == 'apierror' ? 'Luk' : 'Annuller'}
                            </Button>

                            {status == 'changes' && (
                                <Button
                                    variant="contained"
                                    onClick={() => updateData()}
                                    type="button"
                                    //disabled={validationResult == null || validationResult?.errors.length > 0}
                                    //disabled={status != 'changes'}
                                >
                                    Gem data
                                </Button>
                            )}
                        </DialogActions>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ImportModal;
