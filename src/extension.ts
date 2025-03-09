import * as vscode from "vscode";

interface SplitTabGroup {
  name: string;
  uris: string[];
}

export function activate(context: vscode.ExtensionContext) {
  // Helper: Safely gather only those tabs that have a non-empty string label
  function getAllLabeledTabs(): vscode.Tab[] {
    const tabGroups = vscode.window.tabGroups.all || [];
    const allTabs: vscode.Tab[] = [];

    for (const group of tabGroups) {
      if (!group.tabs) continue;
      for (const t of group.tabs) {
        // Ensure t is truthy and has a label we can use
        if (t && typeof t.label === "string" && t.label.trim() !== "") {
          allTabs.push(t);
        }
      }
    }
    return allTabs;
  }

  // COMMAND 1: Split Selected Tabs
  const splitSelectedTabsCmd = vscode.commands.registerCommand(
    "extension.splitSelectedTabs",
    async () => {
      try {
        const allTabs = getAllLabeledTabs();
        if (allTabs.length === 0) {
          vscode.window.showInformationMessage("No labeled tabs found.");
          return;
        }

        // Show Quick Pick with all tab labels
        const pickedLabels = await vscode.window.showQuickPick(
          allTabs.map((tab) => tab.label),
          {
            canPickMany: true,
            placeHolder: "Select tabs to split into separate columns",
          }
        );

        // If user canceled or picked none, exit
        if (!pickedLabels || pickedLabels.length === 0) {
          vscode.window.showInformationMessage("No tabs selected.");
          return;
        }

        // Filter down to the matching Tab objects
        const chosenTabs = allTabs.filter((tab) =>
          pickedLabels.includes(tab.label)
        );
        if (chosenTabs.length === 0) {
          vscode.window.showInformationMessage("No matching tabs found.");
          return;
        }

        // Start splitting tabs into new columns
        let currentColumn =
          vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

        for (const tab of chosenTabs) {
          // Only handle text-based tabs
          if (tab.input instanceof vscode.TabInputText) {
            const docUri = tab.input.uri;
            const doc = await vscode.workspace.openTextDocument(docUri);

            // Check unsaved changes
            if (doc.isDirty) {
              const choice = await vscode.window.showWarningMessage(
                `The file "${docUri.path}" has unsaved changes. Save before splitting?`,
                "Save",
                "Skip"
              );
              if (choice === "Save") {
                await doc.save();
              } else if (choice !== "Skip") {
                continue; // canceled or closed
              }
            }

            // Move to next column
            currentColumn++;
            if (currentColumn > vscode.ViewColumn.Nine) {
              currentColumn = vscode.ViewColumn.Nine;
            }

            // Show the doc
            await vscode.window.showTextDocument(doc, {
              viewColumn: currentColumn,
              preserveFocus: true,
              preview: false,
            });
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error splitting selected tabs: ${error}`
        );
      }
    }
  );

  // COMMAND 2: Create Split Tabs Group
  const createSplitTabGroupCmd = vscode.commands.registerCommand(
    "extension.createSplitTabGroup",
    async () => {
      try {
        const allTabs = getAllLabeledTabs();
        if (allTabs.length === 0) {
          vscode.window.showInformationMessage("No labeled tabs found.");
          return;
        }

        // Show Quick Pick to select tabs
        const pickedLabels = await vscode.window.showQuickPick(
          allTabs.map((tab) => tab.label),
          {
            canPickMany: true,
            placeHolder: "Select tabs to add to a group",
          }
        );

        if (!pickedLabels || pickedLabels.length === 0) {
          vscode.window.showInformationMessage("No tabs selected.");
          return;
        }

        // Filter down to the matching Tab objects
        const chosenTabs = allTabs.filter((tab) =>
          pickedLabels.includes(tab.label)
        );
        if (chosenTabs.length === 0) {
          vscode.window.showInformationMessage("No matching tabs found.");
          return;
        }

        // Prompt for group name
        const groupName = await vscode.window.showInputBox({
          prompt: "Enter a name for this tab group",
          placeHolder: "e.g. My Favorite Tabs",
        });

        if (!groupName) {
          vscode.window.showInformationMessage("Group creation canceled.");
          return;
        }

        // Build group data
        const uris = chosenTabs
          .filter((tab) => tab.input instanceof vscode.TabInputText)
          .map((tab) => (tab.input as vscode.TabInputText).uri.toString());

        // Load existing groups
        const existingGroups: SplitTabGroup[] = context.globalState.get(
          "splitTabGroups",
          []
        );

        // Check if group name already exists
        const duplicate = existingGroups.find(
          (group) => group.name === groupName
        );
        if (duplicate) {
          // Overwrite? or cancel?
          const choice = await vscode.window.showWarningMessage(
            `A group named "${groupName}" already exists. Overwrite it?`,
            "Yes",
            "No"
          );
          if (choice !== "Yes") {
            return;
          }
          // Overwrite existing group
          duplicate.uris = uris;
        } else {
          // Add new group
          existingGroups.push({ name: groupName, uris });
        }

        // Save updated groups
        await context.globalState.update("splitTabGroups", existingGroups);

        vscode.window.showInformationMessage(
          `Tab group "${groupName}" created successfully.`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error creating split tab group: ${error}`
        );
      }
    }
  );

  // COMMAND 3: Open Split Tabs Group
  const openSplitTabGroupCmd = vscode.commands.registerCommand(
    "extension.openSplitTabGroup",
    async () => {
      try {
        const existingGroups: SplitTabGroup[] = context.globalState.get(
          "splitTabGroups",
          []
        );

        if (!existingGroups || existingGroups.length === 0) {
          vscode.window.showInformationMessage("No saved tab groups found.");
          return;
        }

        // Prompt user to pick a group
        const groupName = await vscode.window.showQuickPick(
          existingGroups.map((g) => g.name),
          {
            placeHolder: "Select a tab group to open",
          }
        );

        if (!groupName) {
          vscode.window.showInformationMessage("No group selected.");
          return;
        }

        // Find the chosen group
        const chosenGroup = existingGroups.find((g) => g.name === groupName);
        if (!chosenGroup) {
          vscode.window.showErrorMessage(`Tab group "${groupName}" not found.`);
          return;
        }

        // Open each tab in its own column
        let currentColumn =
          vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

        for (const uriString of chosenGroup.uris) {
          const docUri = vscode.Uri.parse(uriString);
          const doc = await vscode.workspace.openTextDocument(docUri);

          // Check unsaved changes
          if (doc.isDirty) {
            const choice = await vscode.window.showWarningMessage(
              `The file "${docUri.path}" has unsaved changes. Save before opening?`,
              "Save",
              "Skip"
            );
            if (choice === "Save") {
              await doc.save();
            } else if (choice !== "Skip") {
              continue; // canceled or closed
            }
          }

          // Move to next column
          currentColumn++;
          if (currentColumn > vscode.ViewColumn.Nine) {
            currentColumn = vscode.ViewColumn.Nine;
          }

          await vscode.window.showTextDocument(doc, {
            viewColumn: currentColumn,
            preserveFocus: true,
            preview: false,
          });
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error opening split tab group: ${error}`
        );
      }
    }
  );

  // COMMAND 4: List all Split Tab Groups
  const listSplitTabGroupsCmd = vscode.commands.registerCommand(
    "extension.listSplitTabGroups",
    async () => {
      try {
        const existingGroups: SplitTabGroup[] = context.globalState.get(
          "splitTabGroups",
          []
        );

        if (!existingGroups || existingGroups.length === 0) {
          vscode.window.showInformationMessage("No saved tab groups found.");
          return;
        }

        // Let user select a group just to see details
        const pickedGroupName = await vscode.window.showQuickPick(
          existingGroups.map((g) => g.name),
          {
            placeHolder: "Select a group to see its saved files",
          }
        );

        if (!pickedGroupName) {
          vscode.window.showInformationMessage("No group selected.");
          return;
        }

        // Find chosen group
        const foundGroup = existingGroups.find(
          (g) => g.name === pickedGroupName
        );
        if (!foundGroup) {
          vscode.window.showErrorMessage(
            `Group "${pickedGroupName}" does not exist.`
          );
          return;
        }

        // Show an information message with the list of URIs
        const fileList = foundGroup.uris.join("\n• ");
        vscode.window.showInformationMessage(
          `Files in "${foundGroup.name}":\n• ${fileList}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error listing tab groups: ${error}`);
      }
    }
  );

  // COMMAND 5: Delete a Split Tab Group
  const deleteSplitTabGroupCmd = vscode.commands.registerCommand(
    "extension.deleteSplitTabGroup",
    async () => {
      try {
        const existingGroups: SplitTabGroup[] = context.globalState.get(
          "splitTabGroups",
          []
        );

        if (!existingGroups || existingGroups.length === 0) {
          vscode.window.showInformationMessage("No saved tab groups found.");
          return;
        }

        // Prompt user to pick a group to delete
        const groupName = await vscode.window.showQuickPick(
          existingGroups.map((g) => g.name),
          {
            placeHolder: "Select a tab group to delete",
          }
        );

        if (!groupName) {
          vscode.window.showInformationMessage(
            "No group selected for deletion."
          );
          return;
        }

        // Confirm deletion
        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to delete "${groupName}"? This cannot be undone.`,
          "Yes",
          "No"
        );
        if (confirm !== "Yes") {
          vscode.window.showInformationMessage("Delete canceled.");
          return;
        }

        // Remove group from the array
        const updatedGroups = existingGroups.filter(
          (g) => g.name !== groupName
        );
        await context.globalState.update("splitTabGroups", updatedGroups);

        vscode.window.showInformationMessage(
          `Tab group "${groupName}" deleted successfully.`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error deleting tab group: ${error}`);
      }
    }
  );

  // Push all commands to context subscriptions
  context.subscriptions.push(
    splitSelectedTabsCmd,
    createSplitTabGroupCmd,
    openSplitTabGroupCmd,
    listSplitTabGroupsCmd,
    deleteSplitTabGroupCmd
  );
}

export function deactivate() {}
