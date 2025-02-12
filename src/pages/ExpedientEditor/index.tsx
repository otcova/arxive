import { createEffect, createSignal, For, on, Show, untrack } from 'solid-js'
import Button from '../../atoms/Button'
import InputText from '../../atoms/InputText'
import InputTextArea from '../../atoms/InputTextArea'
import { createHook } from '../../database/expedientHook'
import { deleteExpedient } from '../../database/expedientState'
import { realTimeDatabaseExpedientEditor } from '../../database/realTimeEdit'
import { Expedient, ExpedientId, expedientIsBlank, newBlankOrder, Order, sortOrdersByPriority, userFirstName } from '../../database/types'
import { verifyVIN } from '../../database/vin/verify'
import { modelName } from '../../database/vin/wmi'
import { ConfirmationPanel } from '../../templates/ConfirmationPanel'
import ExpedientFolderIcons from '../../templates/ExpedientFolderIcons'
import { OrderEditor } from '../../templates/OrderEditor'
import { useTab } from '../../templates/TabSystem'
import { undoSignal } from '../../utils/undo'
import style from './ExpedientEditor.module.sass'

type Props = {
	expedientId: ExpedientId,
}

export default function ExpedientEditor({ expedientId }: Props) {
	const { closeTab, rename } = useTab()

	const [showConfirmationPanel, setShowConfirmationPanel] = createSignal(false)
	const [expedient, setExpedient] = realTimeDatabaseExpedientEditor(expedientId)

	const orders = () => sortOrdersByPriority(expedient().orders)

	const setupUndo = (container) => undoSignal(expedient, setExpedient, container)

	const updateTabName = () => {
		if (!expedient()) return closeTab()

		const user = userFirstName(expedient().user)
		const orderTitles = orders()
			.filter(([order]) => order.state != "Done" && order.title)
			.map(([order]) => userFirstName(order.title))
		const newName = (user ? [user, ...orderTitles] : orderTitles).join("  -  ")

		rename(newName || "Expedient")
	}
	createEffect(on(expedient, updateTabName, { defer: true }))

	const updateExpedient = (data, path: keyof Expedient) => {
		setExpedient(oldExpedient => {
			const expedient: Expedient = JSON.parse(JSON.stringify(oldExpedient))
			expedient[path] = data
			return expedient
		})
	}

	const updateOrder = (data, index: number, path: keyof Order) => {
		setExpedient(oldExpedient => {
			const expedient: Expedient = JSON.parse(JSON.stringify(oldExpedient))
			expedient.orders[index][path] = data
			return expedient
		})
	}

	const createOrder = () => {
		setExpedient(oldExpedient => {
			const expedient: Expedient = JSON.parse(JSON.stringify(oldExpedient))
			expedient.orders.push(newBlankOrder())
			return expedient
		})
	}

	const deleteExpedientResponse = (confirmedAction) => {
		setShowConfirmationPanel(false)
		if (confirmedAction == "Confirmar") {
			deleteExpedient(expedientId)
		}
	}

	const triggerDeleteSequence = () => {
		if (!expedientIsBlank(expedient())) setShowConfirmationPanel(true)
		else deleteExpedientResponse("Confirmar")
	}

	const detect_vin = (event: ClipboardEvent) => {
		if (!expedient()?.vin) {
			let pasted_text = event.clipboardData.getData("text")
			let founded_vins = Array.from(pasted_text.matchAll(
				/(?=(?:^|:|\s)([A-HJ-NPR-Z\d]{17})(?:\s|$))/gi
			), x => x[1])
			let unique_items = new Set(founded_vins)
			if (unique_items.size == 1) {
				updateExpedient(founded_vins[0], "vin")
			}
		}
	}

	let pastVin = null;
	createEffect(() => {
		if (expedient() && expedient().vin !== pastVin) {
			if (pastVin != null && !untrack(() => expedient().model)) {
				let suggestedModel = modelName(expedient().vin)
				if (suggestedModel) updateExpedient(suggestedModel, "model")
			}
			pastVin = expedient().vin
		}
	})

	const [userSuggestions, setUserFilter] = createHook("list_users", "", { defer: true })
	createEffect(() => setUserFilter(expedient()?.user ?? ""))

	const [modelSuggestions, setModelFilter] = createHook("list_models", "", { defer: true })
	createEffect(() => setModelFilter(expedient()?.model ?? ""))

	const [licenseSuggestions, setLicenseFilter] = createHook("list_license_plates", "", { defer: true })
	createEffect(() => setLicenseFilter(expedient()?.license_plate.replaceAll(" ", "_") ?? ""))

	const [vinSuggestions, setvinFilter] = createHook("list_vins", "", { defer: true })
	createEffect(() => setvinFilter(expedient()?.vin ?? ""))

	return <div class={style.container} ref={setupUndo}>
		<Show when={expedient()}>
			<div class={style.expedient_container}>
				<div class={style.expedient_column_left}>
					<InputText
						placeholder='Usuari'
						value={expedient().user}
						suggestions={userSuggestions()}
						onChange={data => updateExpedient(data, "user")}
						autoFormat={['startWordCapital']}
					/>
					<InputText
						placeholder='Model'
						suggestions={modelSuggestions()}
						value={expedient().model}
						onChange={data => updateExpedient(data, "model")}
					/>
					<div class={style.input_row}>
						<InputText
							autoFormat={['allCapital', 'spaceAfterNumber']}
							suggestions={licenseSuggestions()}
							placeholder='Matricula'
							value={expedient().license_plate}
							onChange={data => updateExpedient(data, "license_plate")}
						/>
						<div class={style.vin_expand_more}>
							<InputText
								autoFormat={['allCapital', 'confusingLettersToNumbers']}
								suggestions={vinSuggestions()}
								placeholder='VIN'
								validate={verifyVIN}
								value={expedient().vin}
								onChange={data => updateExpedient(data, "vin")}
							/>
						</div>
					</div>
					<InputTextArea
						placeholder='Descripció'
						value={expedient().description}
						onChange={data => updateExpedient(data, "description")}
						ref={elem => elem.addEventListener("paste", detect_vin)}
					/>
				</div>
				<div class={style.expedient_column_right}>
					<For each={orders().map(([_, orderIndex]) => orderIndex)}>{(orderIndex) => {
						return <OrderEditor
							expedient={expedient}
							expedientId={expedientId}
							setOrder={(data, path) => updateOrder(data, orderIndex, path)}
							orderIndex={orderIndex}
						/>
					}}</For>
				</div>
			</div>
			<div class={style.bottom_bar}>
				<ExpedientFolderIcons expedient={expedient()} />
				<div class={style.bottom_bar_buttons}>
					<Button text="Eliminar" red action={triggerDeleteSequence} />
					<Button text="Nova Comanda" action={createOrder} />
					<Button text="Arxivar" action={closeTab} />
				</div>
			</div>
			<ConfirmationPanel text="Eliminar Expedient"
				show={showConfirmationPanel()}
				redButtons={["Cancelar"]}
				buttons={["Confirmar"]}
				response={deleteExpedientResponse}
			/>
		</Show >
	</div>
}