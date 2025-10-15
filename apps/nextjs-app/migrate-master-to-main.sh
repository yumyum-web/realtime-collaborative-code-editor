#!/bin/bash

# Git Repo Cleanup Script
# This script migrates all existing Git repos from master to main branch

echo "🔍 Scanning for Git repositories with master branch..."

repos_dir="./repos"

if [ ! -d "$repos_dir" ]; then
    echo "❌ repos/ directory not found"
    exit 1
fi

count=0
migrated=0
skipped=0

for project_dir in "$repos_dir"/*; do
    if [ -d "$project_dir/.git" ]; then
        count=$((count + 1))
        project_name=$(basename "$project_dir")
        
        cd "$project_dir" || continue
        
        # Check if master branch exists
        if git show-ref --verify --quiet refs/heads/master; then
            # Check if main already exists
            if git show-ref --verify --quiet refs/heads/main; then
                echo "⚠️  $project_name: Both master and main exist"
                
                # Checkout main if on master
                current_branch=$(git rev-parse --abbrev-ref HEAD)
                if [ "$current_branch" = "master" ]; then
                    git checkout main
                    echo "  ✓ Checked out main"
                fi
                
                # Delete master
                git branch -D master
                echo "  ✓ Deleted duplicate master branch"
                migrated=$((migrated + 1))
            else
                echo "🔄 $project_name: Renaming master to main"
                git branch -m master main
                echo "  ✓ Renamed master to main"
                migrated=$((migrated + 1))
            fi
        else
            # Check if main exists
            if git show-ref --verify --quiet refs/heads/main; then
                echo "✓  $project_name: Already on main branch"
                skipped=$((skipped + 1))
            else
                echo "⚠️  $project_name: No master or main branch found"
            fi
        fi
        
        cd - > /dev/null || exit
    fi
done

echo ""
echo "📊 Summary:"
echo "  Total repos: $count"
echo "  Migrated: $migrated"
echo "  Already on main: $skipped"
echo ""
echo "✅ Migration complete!"
