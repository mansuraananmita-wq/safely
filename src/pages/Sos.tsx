import { useState, type FormEvent } from 'react'
import { SosButton } from '../components/SosButton'
import { SosInbox } from '../components/SosInbox'
import { Button, Field, useTitle } from '../components/ui'
import { useApp } from '../store'

export function SosPage() {
  const { currentUser, state, tx, toast, addEmergencyContact, removeEmergencyContact } = useApp()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  useTitle(tx('SOS', 'এসওএস'))
  if (!currentUser) return null
  const mine = (state.emergencyContacts ?? []).filter((item) => item.userId === currentUser.id)
  const desk = currentUser.role === 'admin' || currentUser.role === 'security'

  const add = (event: FormEvent) => {
    event.preventDefault()
    void addEmergencyContact(name, phone).then((result) => {
      if (result === 'ok') {
        setName('')
        setPhone('')
        toast(tx('Number saved.', 'নম্বর সেভ হয়েছে।'))
        return
      }
      const text = result === 'name'
        ? tx('Add the person’s name.', 'ব্যক্তির নাম লিখুন।')
        : result === 'phone'
          ? tx('Use a mobile number, such as 01XXXXXXXXX. 999 is not accepted here.', '০১ দিয়ে মোবাইল নম্বর লিখুন। এখানে ৯৯৯ নেওয়া হয় না।')
          : result === 'limit'
            ? tx('Five numbers is the limit.', 'পাঁচটি নম্বরের বেশি যায় না।')
            : result === 'duplicate'
              ? tx('That number is already saved.', 'এই নম্বর আগেই সেভ আছে।')
              : tx('The number was not saved.', 'নম্বর সেভ হয়নি।')
      toast(text)
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-4xl">{desk ? tx('SOS desk', 'এসওএস ডেস্ক') : tx('SOS', 'এসওএস')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/70">
          {desk
            ? tx('Help messages land here with the sender’s location. The desk does not need a phone number.', 'সাহায্যের বার্তা পাঠানো ব্যক্তির লোকেশনসহ এখানে আসে। ডেস্কের ফোন নম্বর লাগে না।')
            : tx('Press SOS, then you have 3 seconds to cancel. If you do not cancel, the campus desk gets a help message with your location. Saved numbers are extra. This button does not call 999.', 'SOS চাপলে ৩ সেকেন্ড সময় পাবেন বাতিল করতে। বাতিল না করলে ক্যাম্পাস ডেস্ক লোকেশনসহ সাহায্যের বার্তা পায়। সেভ করা নম্বর অতিরিক্ত। এই বোতাম ৯৯৯-এ কল করে না।')}
        </p>
      </div>
      {desk ? <SosInbox /> : null}
      <SosButton large />
      <form className="panel space-y-3 p-5" onSubmit={add}>
        <h2 className="font-display text-2xl">{tx('Extra phone numbers', 'অতিরিক্ত ফোন নম্বর')}</h2>
        <p className="text-sm text-ink/65">{tx('Optional. The campus desk already receives the message. These people get a text when phone texts are turned on.', 'ঐচ্ছিক। ক্যাম্পাস ডেস্ক বার্তা আগেই পায়। ফোন বার্তা চালু থাকলে এই মানুষদের কাছেও যায়।')}</p>
        <Field label={tx('Name', 'নাম')}>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </Field>
        <Field label={tx('Mobile number', 'মোবাইল নম্বর')} hint={tx('Bangladesh numbers can be 01XXXXXXXXX. Other countries need + and the country code.', 'বাংলাদেশের নম্বর ০১ দিয়ে লেখা যায়। অন্য দেশে + ও কান্ট্রি কোড দিন।')}>
          <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" />
        </Field>
        <Button type="submit">{tx('Save number', 'নম্বর সেভ')}</Button>
        <ul className="divide-y divide-line">
          {mine.length === 0 ? <li className="py-3 text-sm text-ink/60">{tx('No extra numbers. SOS still reaches the campus desk.', 'অতিরিক্ত নম্বর নেই। SOS তবু ক্যাম্পাস ডেস্কে যায়।')}</li> : mine.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-ink/60">{item.phone}</p>
              </div>
              <button type="button" className="text-sm font-semibold text-clay" onClick={() => void removeEmergencyContact(item.id)}>{tx('Remove', 'সরান')}</button>
            </li>
          ))}
        </ul>
      </form>
      {desk ? null : <SosInbox />}
    </div>
  )
}
