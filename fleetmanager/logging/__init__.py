import logging.config

import os
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

logging_config = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'default': {
            'format': '%(levelname)s:     %(name)s: %(message)s',
        },
    },
    'handlers': {
        'stdout': {
            'class': 'logging.StreamHandler',
            'formatter': 'default',
            'level': 'DEBUG',
            'stream': 'ext://sys.stdout',
        },
        'stderr': {
            'class': 'logging.StreamHandler',
            'formatter': 'default',
            'level': 'ERROR',
            'stream': 'ext://sys.stderr',
        }
    },
    'root': {
        'handlers': ['stderr', 'stdout'],
        'level': LOG_LEVEL,
    },
}
logging.config.dictConfig(logging_config)
import logging
