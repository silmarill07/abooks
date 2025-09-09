#!/usr/bin/env python3

import os
import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, Gdk

class AudioArrayGenerator(Gtk.Window):
    def __init__(self):
        Gtk.Window.__init__(self, title="Генератор массива аудио")
        self.set_default_size(700, 500)

        # Тёмная тема
        settings = Gtk.Settings.get_default()
        settings.set_property("gtk-application-prefer-dark-theme", True)

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.add(vbox)

        # Верхняя строка: папка и обзор
        hbox_folder = Gtk.Box(spacing=6)
        vbox.pack_start(hbox_folder, False, False, 0)

        self.folder_entry = Gtk.Entry()
        self.folder_entry.set_text("audio")
        hbox_folder.pack_start(self.folder_entry, True, True, 0)

        browse_button = Gtk.Button(label="Обзор")
        browse_button.connect("clicked", self.on_browse)
        hbox_folder.pack_start(browse_button, False, False, 0)

        # Вторая строка: кнопки
        hbox_buttons = Gtk.Box(spacing=6)
        vbox.pack_start(hbox_buttons, False, False, 0)

        generate_button = Gtk.Button(label="Сгенерировать массив")
        generate_button.connect("clicked", self.on_generate)
        hbox_buttons.pack_start(generate_button, True, True, 0)

        copy_button = Gtk.Button(label="Скопировать массив")
        copy_button.connect("clicked", self.on_copy)
        hbox_buttons.pack_start(copy_button, True, True, 0)

        # Текстовое поле
        self.textview = Gtk.TextView()
        self.textview.set_wrap_mode(Gtk.WrapMode.WORD)
        self.textbuffer = self.textview.get_buffer()
        scrolled = Gtk.ScrolledWindow()
        scrolled.add(self.textview)
        vbox.pack_start(scrolled, True, True, 0)

    def on_copy(self, widget):
        clipboard = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
        start_iter = self.textbuffer.get_start_iter()
        end_iter = self.textbuffer.get_end_iter()
        text = self.textbuffer.get_text(start_iter, end_iter, True)
        clipboard.set_text(text, -1)

    def on_browse(self, widget):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        dialog = Gtk.FileChooserDialog(
            title="Выберите папку с аудио",
            parent=self,
            action=Gtk.FileChooserAction.SELECT_FOLDER,
        )
        dialog.set_current_folder(script_dir)
        dialog.add_buttons(
            Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
            Gtk.STOCK_OPEN, Gtk.ResponseType.OK
        )
        if dialog.run() == Gtk.ResponseType.OK:
            self.folder_entry.set_text(dialog.get_filename())
        dialog.destroy()

    def on_generate(self, widget):
        folder_path = self.folder_entry.get_text()
        if not os.path.isdir(folder_path):
            self.show_error("Выбранная папка не существует!")
            return

        parent_folder = os.path.basename(os.path.dirname(folder_path))
        folder_name = os.path.basename(folder_path)

        files = sorted(f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f)))

        array_lines = []
        for idx, f in enumerate(files, 1):
            title = f'Глава {idx}'
            safe_folder = folder_name.replace(" ", "%20").replace("'", "%27")
            safe_parent = parent_folder.replace(" ", "%20").replace("'", "%27")
            file_path = f'../{safe_parent}/{safe_folder}/{f}'
            array_lines.append(f'{{ title: "{title}", file: "{file_path}" }}')

        output = "audioFiles: [\n" + ",\n".join(array_lines) + "\n]"
        self.textbuffer.set_text(output)

    def show_error(self, message):
        dialog = Gtk.MessageDialog(
            parent=self,
            flags=0,
            message_type=Gtk.MessageType.ERROR,
            buttons=Gtk.ButtonsType.OK,
            text=message
        )
        dialog.run()
        dialog.destroy()

if __name__ == "__main__":
    win = AudioArrayGenerator()
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    Gtk.main()