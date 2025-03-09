    #!/bin/bash

    # Ensure the GitHub CLI is installed
    if ! command -v gh &> /dev/null
    then
        echo "GitHub CLI (gh) could not be found. Please install it first."
        exit
    fi

    # Ensure the .env file exists
    if [ ! -f .env ]; then
        echo ".env file not found!"
        exit 1
    fi

    # Read the repository name from the git config
    REPO=$(git config --get remote.origin.url | sed 's/.*github.com.//;s/.git$//')

    if [ -z "$REPO" ]; then
        echo "Could not determine the repository name. Ensure you are in a git repository."
        exit 1
    fi

    # Read the .env file and set each variable as a GitHub secret
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ $line == \#* ]] || [[ -z $line ]]; then
            continue
        fi

        if [[ $line == *"="* ]]; then
            if [[ -n "$key" ]]; then
                echo "Attempting to set secret: $key"
                gh secret set "$key" -b"$value" -R "$REPO"
            fi
            IFS='=' read -r key value <<< "$line"
        else
            value+=$'\n'$line
        fi
    done < .env

    # Set the last secret
    if [[ -n "$key" ]]; then
        echo "Attempting to set secret: $key"
        gh secret set "$key" -b"$value" -R "$REPO"
    fi

    echo "All environment variables from .env have been set as secrets in the repository $REPO."