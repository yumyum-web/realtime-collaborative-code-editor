import { config } from "dotenv";
import connectDB from "../app/lib/mongoose";
import Project from "../app/models/project";

// Load environment variables
config({ path: "../.env" });

async function migrateGitBranches() {
  try {
    await connectDB();
    console.log("Starting gitBranches migration...");

    // Find all projects
    const projects = await Project.find({});
    console.log(`Found ${projects.length} projects to check`);

    let updatedCount = 0;

    for (const project of projects) {
      let needsUpdate = false;

      // Check if gitBranches contains strings instead of objects
      if (project.gitBranches && project.gitBranches.length > 0) {
        const firstBranch = project.gitBranches[0];

        // If it's a string, we need to convert
        if (typeof firstBranch === "string") {
          console.log(`Converting gitBranches for project ${project.title}`);
          // Convert string array to object array
          // We'll assume the first branch is current
          project.gitBranches = (project.gitBranches as string[]).map(
            (branchName, index) => ({
              name: branchName,
              current: index === 0, // Assume first branch is current
            }),
          );
          needsUpdate = true;
        }
      }

      // Save if any branches were updated
      if (needsUpdate) {
        await project.save();
        updatedCount++;
      }
    }

    console.log(`Migration complete. Updated ${updatedCount} projects.`);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateGitBranches();
