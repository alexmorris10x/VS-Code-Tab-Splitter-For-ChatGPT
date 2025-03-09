import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  // COMMAND 1: Split Selected Tabs (via Quick Pick)
  const splitSelectedTabsCmd = vscode.commands.registerCommand(
    "extension.splitSelectedTabs",
    async () => {
      try {
        // Gather all open tabs
        const allTabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);

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

  // COMMAND 2: Split Highlighted Tabs (via proposed API for isSelected)
  const splitHighlightedTabsCmd = vscode.commands.registerCommand(
    "extension.splitHighlightedTabs",
    async () => {
      try {
        // Gather all open tabs
        const allTabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);

        // Attempt to detect which tabs are highlighted (using proposed API)
        const selectedTabs = allTabs.filter((tab) => (tab as any).isSelected);

        if (selectedTabs.length === 0) {
          vscode.window.showInformationMessage("No tabs are highlighted.");
          return;
        }

        // Split each highlighted tab into its own column
        let currentColumn =
          vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

        for (const tab of selectedTabs) {
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

            // Move to the next column
            currentColumn++;
            if (currentColumn > vscode.ViewColumn.Nine) {
              currentColumn = vscode.ViewColumn.Nine;
            }

            // Show the doc in the new column
            await vscode.window.showTextDocument(doc, {
              viewColumn: currentColumn,
              preserveFocus: true,
              preview: false,
            });
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error splitting highlighted tabs: ${error}`
        );
      }
    }
  );

  // Push both commands to context subscriptions
  context.subscriptions.push(splitSelectedTabsCmd, splitHighlightedTabsCmd);
}

export function deactivate() {}
