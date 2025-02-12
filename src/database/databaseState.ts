import { documentDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/tauri";
import { databaseError, setDatabaseError } from ".";

export let databaseDir = ""


setTimeout(async () => {
	databaseDir = await documentDir() + "Archive"
	await openDatabase()
	setInterval(saveDatabase, 1000 * 30)
})


const criticalError = (error, msg?) => setDatabaseError({
	error,
	msg,
	button: "Tancar",
	action: () => window.close(),
})

const unclassifiedError = (error) => criticalError("Error", error)
const lockError = () => criticalError("L'aplicació només pot estar oberta un cop")

const requestCreateDatabase = () => setDatabaseError({
	msg: "No s'ha trobat cap base de dades",
	button: "Crear Base de Dades",
	action: createDatabase
})

async function openDatabase() {
	try {
		await invoke('open_database', { path: databaseDir })
		setDatabaseError(null)
	} catch (error) {
		switch (error) {
			case "NotFound": return requestCreateDatabase()
			case "Collision": return lockError()
			case "DataIsCorrupted": return loadRollbackInfo()
			case "AlreadyOpen":
				await invoke('release_all_hooks')
				return setDatabaseError(null)
		}
		unclassifiedError(error)
	}
}

async function createDatabase() {
	try {
		await invoke('create_database', { path: databaseDir })
		setDatabaseError(null)
	} catch (error) {
		switch (error) {
			case "AlreadyExists": return criticalError(
				"Error en crear base de dades",
				`La carpeta '${databaseDir}' no està buida`
			)
			case "Collision": return lockError()
		}
		unclassifiedError(error)
	}
}

async function loadRollbackInfo() {
	setDatabaseError({
		error: "S'ha trobat informació corrupte a la base de dates",
		msg: "Buscant la copia de seguretat més recent no corrupte ...",
	})
	try {
		const info: { newest_instant: string, rollback_instant: string } =
			await invoke("database_rollback_info", { path: databaseDir })
		setDatabaseError({
			error: "S'ha trobat informació corrupte a la base de dades",
			msg: `Dades corruptes:   ${info.newest_instant}\nCopia de seguretat:   ${info.rollback_instant}`,
			button: "Continuar a partir de la copia de seguretat",
			action: loadRollback,
		})
	} catch (error) {
		if (error == "NotFound") {
			return criticalError(
				"S'ha trobat informació corrupte a la base de dates",
				"No s'ha pogut recuperar cap copia de seguretat",
			)
		}
		unclassifiedError(error)
	}
}

async function loadRollback() {
	try {
		await invoke('rollback_database', { path: databaseDir })
		setDatabaseError(null)
	} catch (error) {
		switch (error) {
			case "NotFound": return criticalError("No s'ha pogut recuperar cap copia de seguretat")
			case "Collision": return lockError()
		}
		unclassifiedError(error)
	}
}

export async function trySaveDatabase() {
	try {
		await invoke('store_database')
		return true
	}
	catch (error) { return error }
}

export async function saveDatabase() {
	if (!databaseError()) {
		if (!await trySaveDatabase()) {
			let error = await trySaveDatabase();
			if (error !== true) criticalError("Error en guardar les dades!!!", error)
		}
	}


}

export async function saveAndCloseApp() {
	await saveDatabase()
	window.close()
}