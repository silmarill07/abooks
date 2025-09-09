#!/usr/bin/env python3

import os
import gi
import subprocess
from threading import Thread
import re
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, Gdk, GLib

class AudioArrayGenerator(Gtk.Window):
    def __init__(self):
        Gtk.Window.__init__(self, title="Генератор массива аудио")
        self.set_default_size(700, 600)
        self.converted_to_mp3 = False
        self.cover_path = ""
        self.book_title = ""

        # Тёмная тема
        settings = Gtk.Settings.get_default()
        settings.set_property("gtk-application-prefer-dark-theme", True)

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.add(vbox)

        # Название книги
        hbox_title = Gtk.Box(spacing=6)
        vbox.pack_start(hbox_title, False, False, 0)
        label_title = Gtk.Label(label="Название книги:")
        hbox_title.pack_start(label_title, False, False, 0)
        self.title_entry = Gtk.Entry()
        hbox_title.pack_start(self.title_entry, True, True, 0)

        # Обложка
        hbox_cover = Gtk.Box(spacing=6)
        vbox.pack_start(hbox_cover, False, False, 0)
        label_cover = Gtk.Label(label="Обложка:")
        hbox_cover.pack_start(label_cover, False, False, 0)
        self.cover_entry = Gtk.Entry()
        hbox_cover.pack_start(self.cover_entry, True, True, 0)
        cover_button = Gtk.Button(label="Обзор")
        cover_button.connect("clicked", self.on_cover_browse)
        hbox_cover.pack_start(cover_button, False, False, 0)

        # Папка с аудио
        hbox_folder = Gtk.Box(spacing=6)
        vbox.pack_start(hbox_folder, False, False, 0)
        label_folder = Gtk.Label(label="Аудио:")
        hbox_folder.pack_start(label_folder, False, False, 0)
        self.folder_entry = Gtk.Entry()
        self.folder_entry.set_text("audio")
        hbox_folder.pack_start(self.folder_entry, True, True, 0)
        browse_button = Gtk.Button(label="Обзор")
        browse_button.connect("clicked", self.on_browse)
        hbox_folder.pack_start(browse_button, False, False, 0)

        # Кнопки действий
        hbox_buttons = Gtk.Box(spacing=6)
        vbox.pack_start(hbox_buttons, False, False, 0)

        self.convert_button = Gtk.Button(label="Конвертировать в MP3")
        self.convert_button.connect("clicked", self.on_convert)
        hbox_buttons.pack_start(self.convert_button, True, True, 0)

        generate_button = Gtk.Button(label="Сгенерировать массив")
        generate_button.connect("clicked", self.on_generate)
        hbox_buttons.pack_start(generate_button, True, True, 0)

        copy_button = Gtk.Button(label="Скопировать массив")
        copy_button.connect("clicked", self.on_copy)
        hbox_buttons.pack_start(copy_button, True, True, 0)

        # Текстовое поле для массива
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
        dialog.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                           Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
        if dialog.run() == Gtk.ResponseType.OK:
            self.folder_entry.set_text(dialog.get_filename())
        dialog.destroy()

    def on_cover_browse(self, widget):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        dialog = Gtk.FileChooserDialog(
            title="Выберите обложку",
            parent=self,
            action=Gtk.FileChooserAction.OPEN,
        )
        dialog.set_current_folder(script_dir)
        dialog.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                           Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
        filter_image = Gtk.FileFilter()
        filter_image.set_name("Изображения")
        filter_image.add_mime_type("image/jpeg")
        filter_image.add_mime_type("image/png")
        dialog.add_filter(filter_image)
        if dialog.run() == Gtk.ResponseType.OK:
            self.cover_entry.set_text(dialog.get_filename())
            self.cover_path = dialog.get_filename()
        dialog.destroy()

    def on_convert(self, widget):
        folder_path = self.folder_entry.get_text()
        if not os.path.isdir(folder_path):
            self.show_error("Выбранная папка не существует!")
            return
        mp3_dir = os.path.join(folder_path, "mp3")
        os.makedirs(mp3_dir, exist_ok=True)
        files = [f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))]
        total = len(files)
        if total == 0:
            self.show_error("Нет файлов для конвертации!")
            return

        progress_dialog = Gtk.MessageDialog(parent=self, flags=0,
                                            message_type=Gtk.MessageType.INFO,
                                            buttons=Gtk.ButtonsType.NONE,
                                            text=f"Конвертация: 0/{total}")
        progress_dialog.show_all()

        def convert_thread():
            for idx, f in enumerate(files, 1):
                in_file = os.path.join(folder_path, f)
                out_file = os.path.join(mp3_dir, f"{os.path.splitext(f)[0]}.mp3")
                try:
                    subprocess.run(["ffmpeg", "-y", "-i", in_file, "-q:a", "0", out_file], check=True,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except subprocess.CalledProcessError:
                    GLib.idle_add(self.show_error, f"Ошибка при конвертации {f}")
                    break
                GLib.idle_add(progress_dialog.set_markup, f"Конвертация: {idx}/{total}")
            else:
                self.converted_to_mp3 = True
                GLib.idle_add(progress_dialog.set_markup, f"Конвертация завершена: {total}/{total}")
            GLib.idle_add(progress_dialog.destroy)

        Thread(target=convert_thread).start()

    def on_generate(self, widget):
        folder_path = self.folder_entry.get_text()
        if not os.path.isdir(folder_path):
            self.show_error("Выбранная папка не существует!")
            return

        title_text = self.title_entry.get_text().strip()
        if not title_text:
            self.show_error("Введите название книги!")
            return
        cover_file = os.path.basename(self.cover_entry.get_text()) if self.cover_entry.get_text() else ""
        parent_folder = os.path.basename(os.path.dirname(folder_path))
        folder_name = os.path.basename(folder_path)
        full_path = folder_path
        if self.converted_to_mp3:
            folder_name = os.path.join(folder_name, "mp3")
            full_path = os.path.join(folder_path, "mp3")

        files = sorted(f for f in os.listdir(full_path) if os.path.isfile(os.path.join(full_path, f)))
        array_lines = []
        for idx, f in enumerate(files, 1):
            title = f'Глава {idx}'
            safe_folder = folder_name.replace(" ", "%20").replace("'", "%27")
            safe_parent = parent_folder.replace(" ", "%20").replace("'", "%27")
            file_path = f'{safe_parent}/{safe_folder}/{f}'
            array_lines.append(f'{{ title: "{title}", file: "{file_path}" }}')

        # id из названия (только латиница, цифры и _)
        id_value = re.sub(r'[^a-zA-Z0-9_]', '', title_text.replace(" ", "_"))

        output = f"""{{
    id: "{id_value}",
    title: "{title_text}",
    cover: "img/{cover_file}",
    audioFiles: [
Аудио:
{',\n'.join(array_lines)}
    ]
}}"""
        self.textbuffer.set_text(output)

    def show_error(self, message):
        dialog = Gtk.MessageDialog(parent=self, flags=0,
                                   message_type=Gtk.MessageType.ERROR,
                                   buttons=Gtk.ButtonsType.OK,
                                   text=message)
        dialog.run()
        dialog.destroy()

if __name__ == "__main__":
    win = AudioArrayGenerator()
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    Gtk.main()
