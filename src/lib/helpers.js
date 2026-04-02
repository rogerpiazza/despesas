export function currentMonthYear() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthYear(my) {
  const [year, month] = my.split('-')
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${months[parseInt(month) - 1]} ${year}`
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Calcula a sugestão de pagamento para o mês.
 * Retorna para cada conta fixa: quem deveria pagar, baseado em:
 * 1. Proporção de renda (quem ganha mais paga mais)
 * 2. Timing (a renda disponível antes do vencimento)
 *
 * @param {Array} incomes  - [{person_id, person_name, amount, received_date}]
 * @param {Array} bills    - [{id, name, due_day, amount}]
 * @returns {Array} suggestions - [{bill, payer_id, payer_name, income_source, reason}]
 */
export function calculateSuggestions(incomes, bills) {
  if (!incomes.length || !bills.length) return []

  // Agrupa renda por pessoa
  const byPerson = {}
  for (const inc of incomes) {
    if (!byPerson[inc.person_id]) {
      byPerson[inc.person_id] = { person_id: inc.person_id, person_name: inc.person_name, total: 0, incomes: [] }
    }
    byPerson[inc.person_id].total += Number(inc.amount)
    byPerson[inc.person_id].incomes.push(inc)
  }

  const people = Object.values(byPerson)
  const grandTotal = people.reduce((s, p) => s + p.total, 0)
  if (grandTotal === 0) return []

  const totalBills = bills.reduce((s, b) => s + Number(b.amount), 0)

  // Cota proporcional de cada pessoa (o quanto deve pagar do total de contas)
  for (const p of people) {
    p.proportion = p.total / grandTotal
    p.remaining = p.proportion * totalBills // quanto ainda falta atribuir a ela
  }

  const sortedBills = [...bills].sort((a, b) => a.due_day - b.due_day)
  const suggestions = []

  for (const bill of sortedBills) {
    const billAmount = Number(bill.amount)

    // Identifica quem tem renda disponível antes do vencimento
    function getBestIncome(person) {
      const timely = person.incomes
        .filter(inc => new Date(inc.received_date).getDate() <= bill.due_day)
        .sort((a, b) => new Date(b.received_date) - new Date(a.received_date))
      return timely[0] || person.incomes.sort((a, b) => new Date(a.received_date) - new Date(b.received_date))[0]
    }

    // Tenta atribuir a conta inteira para quem ainda tem cota suficiente
    const canCoverFull = people.filter(p => p.remaining >= billAmount - 0.01)

    if (canCoverFull.length > 0) {
      // Pega quem tem mais cota restante e tem renda antes do vencimento
      const withTimely = canCoverFull.filter(p => p.incomes.some(inc => new Date(inc.received_date).getDate() <= bill.due_day))
      const best = (withTimely.length > 0 ? withTimely : canCoverFull)
        .reduce((a, b) => a.remaining > b.remaining ? a : b)

      best.remaining -= billAmount
      suggestions.push({
        bill,
        payer_id: best.person_id,
        payer_name: best.person_name,
        income_name: getBestIncome(best)?.income_source_name || 'Renda',
        income_date: getBestIncome(best)?.received_date,
        proportion: (best.proportion * 100).toFixed(1),
        amount: billAmount,
        split: false,
      })
    } else {
      // Ninguém cobre sozinho — divide entre todas as pessoas proporcionalmente ao que resta de cota
      const totalRemaining = people.reduce((s, p) => s + Math.max(p.remaining, 0), 0)

      for (const p of people) {
        const share = totalRemaining > 0
          ? (Math.max(p.remaining, 0) / totalRemaining) * billAmount
          : billAmount / people.length

        if (share < 0.01) continue

        p.remaining -= share
        suggestions.push({
          bill,
          payer_id: p.person_id,
          payer_name: p.person_name,
          income_name: getBestIncome(p)?.income_source_name || 'Renda',
          income_date: getBestIncome(p)?.received_date,
          proportion: (p.proportion * 100).toFixed(1),
          amount: share,
          split: true,
        })
      }
    }
  }

  return suggestions
}

/**
 * Calcula o encontro de contas do mês.
 * Retorna quanto cada pessoa pagou, quanto deveria pagar e o saldo.
 */
export function calculateSettlement(incomes, billPayments, extras) {
  const byPerson = {}

  const allPayments = [
    ...billPayments.map(p => ({ person_id: p.paid_by, person_name: p.person_name, amount: Number(p.amount) })),
    ...extras.map(e => ({ person_id: e.paid_by, person_name: e.person_name, amount: Number(e.amount) })),
  ]

  // Inicializa com rendas
  for (const inc of incomes) {
    if (!byPerson[inc.person_id]) {
      byPerson[inc.person_id] = { person_id: inc.person_id, person_name: inc.person_name, income: 0, paid: 0 }
    }
    byPerson[inc.person_id].income += Number(inc.amount)
  }

  // Soma pagamentos
  for (const pay of allPayments) {
    if (!byPerson[pay.person_id]) {
      byPerson[pay.person_id] = { person_id: pay.person_id, person_name: pay.person_name, income: 0, paid: 0 }
    }
    byPerson[pay.person_id].paid += pay.amount
  }

  const people = Object.values(byPerson)
  const grandTotal = people.reduce((s, p) => s + p.income, 0)
  const totalPaid = people.reduce((s, p) => s + p.paid, 0)

  for (const p of people) {
    p.proportion = grandTotal > 0 ? p.income / grandTotal : 1 / people.length
    p.shouldPay = p.proportion * totalPaid
    p.balance = p.paid - p.shouldPay // positivo = pagou mais do que devia
  }

  // Calcula transferência: quem pagou menos deve transferir para quem pagou mais
  let transfer = null
  if (people.length === 2) {
    const [a, b] = people
    if (Math.abs(a.balance) > 0.01) {
      const debtor = a.balance < 0 ? a : b
      const creditor = a.balance > 0 ? a : b
      transfer = {
        from: debtor.person_name,
        to: creditor.person_name,
        amount: Math.abs(debtor.balance),
      }
    }
  }

  return { people, totalPaid, grandTotal, transfer }
}
